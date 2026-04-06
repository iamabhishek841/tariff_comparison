from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import pandas as pd


def get_data_file_path(base_folder: str | Path, filename: str) -> Path:
    base = Path(base_folder)
    return base / "data" / filename


@dataclass(frozen=True)
class FlexibilityConfig:
    spread_weight: float = 0.4
    volatility_weight: float = 0.3
    load_weight: float = 0.3


def _normalize_0_1(series: pd.Series) -> pd.Series:
    numeric = pd.Series(pd.to_numeric(series, errors="coerce"), index=series.index).fillna(0.0)
    min_val = float(numeric.min())
    max_val = float(numeric.max())
    if max_val <= min_val:
        return pd.Series([0.0] * len(numeric), index=numeric.index)
    return (numeric - min_val) / (max_val - min_val)


def _flexibility_level(score: float) -> str:
    if score >= 0.7:
        return "High"
    if score >= 0.4:
        return "Medium"
    return "Low"


def read_combined_profiles(load_profiles_path: str | Path) -> pd.DataFrame:
    df = pd.read_excel(load_profiles_path, sheet_name="combined_profiles_long")
    required = {"occupancy_group", "dwelling_group", "slot", "final_share"}
    missing = required.difference(df.columns)
    if missing:
        raise ValueError(f"combined_profiles_long is missing columns: {sorted(missing)}")

    out = df[["occupancy_group", "dwelling_group", "slot", "final_share"]].copy()
    out["slot"] = pd.to_numeric(out["slot"], errors="coerce")
    out["final_share"] = pd.to_numeric(out["final_share"], errors="coerce")
    out = out.dropna(subset=["slot", "final_share"])
    out["slot"] = out["slot"].astype(int)
    out = out[out["slot"].between(1, 48)]
    return out


def convert_48_slot_to_24_hour_load_scores(combined_profiles_long: pd.DataFrame) -> pd.DataFrame:
    # Convert each profile's 48-slot shares into 24 hourly shares, then average by hour.
    profile_hour = combined_profiles_long.copy()
    profile_hour["hour"] = (profile_hour["slot"] - 1) // 2

    profile_hour = profile_hour.groupby(
        ["occupancy_group", "dwelling_group", "hour"], as_index=False
    ).agg(hour_share=("final_share", "sum"))

    average_hour_share = profile_hour.groupby("hour", as_index=False).agg(load=("hour_share", "mean"))
    average_hour_share["load_score"] = _normalize_0_1(average_hour_share["load"])
    return average_hour_share[["hour", "load_score"]]


def read_market_data(market_path: str | Path, sheet_name: Optional[str] = None) -> pd.DataFrame:
    market_path = Path(market_path)
    if market_path.suffix.lower() == ".csv":
        df = pd.read_csv(market_path)
    else:
        df = pd.read_excel(market_path, sheet_name=sheet_name or 0)

    required = {"half_hour", "spread/kwh", "dam_price/kwh", "target_settlement/kwh"}
    missing = required.difference(df.columns)
    if missing:
        raise ValueError(f"Market data is missing columns: {sorted(missing)}")

    out = df[["half_hour", "spread/kwh", "dam_price/kwh", "target_settlement/kwh"]].copy()
    out["half_hour"] = pd.to_numeric(out["half_hour"], errors="coerce")
    out["spread/kwh"] = pd.to_numeric(out["spread/kwh"], errors="coerce")
    out["dam_price/kwh"] = pd.to_numeric(out["dam_price/kwh"], errors="coerce")
    out["target_settlement/kwh"] = pd.to_numeric(out["target_settlement/kwh"], errors="coerce")
    out = out.dropna(subset=["half_hour", "spread/kwh"])
    out["half_hour"] = out["half_hour"].astype(int)
    out = out[out["half_hour"].between(0, 47)]
    out["hour"] = out["half_hour"] // 2
    return out


def _build_hourly_volatility(market_df: pd.DataFrame) -> pd.DataFrame:
    by_hour_counts = market_df.groupby("hour")["spread/kwh"].size()

    if int(by_hour_counts.max()) > 1:
        spread_std = market_df.groupby("hour")["spread/kwh"].std(ddof=0)
        volatility: pd.DataFrame = pd.DataFrame(
            {
                "hour": spread_std.index.to_numpy(dtype=int),
                "volatility": spread_std.to_numpy(dtype=float),
            }
        )
        volatility.fillna({"volatility": 0.0}, inplace=True)
        return volatility

    # Fallback when only one observation per hour is available.
    ordered = market_df.sort_values("half_hour").copy()
    ordered["rolling_std"] = ordered["spread/kwh"].rolling(window=4, min_periods=2).std(ddof=0)

    rows: list[dict[str, float]] = []
    for hour in range(24):
        hour_series = ordered.loc[ordered["hour"] == hour, "rolling_std"]
        if hour_series.empty:
            hour_value = 0.0
        else:
            mean_value = hour_series.mean()
            hour_value = 0.0 if pd.isna(mean_value) else float(mean_value)
        rows.append({"hour": float(hour), "volatility": hour_value})

    volatility: pd.DataFrame = pd.DataFrame(rows)
    volatility["hour"] = volatility["hour"].astype(int)
    return volatility


def build_hourly_market_scores(market_df: pd.DataFrame) -> pd.DataFrame:
    spread_hourly = market_df.groupby("hour", as_index=False).agg(spread=("spread/kwh", "mean"))
    volatility_hourly = _build_hourly_volatility(market_df)

    hourly = spread_hourly.merge(volatility_hourly, on="hour", how="left")
    hourly["volatility"] = hourly["volatility"].fillna(0.0)

    hourly["spread_score"] = _normalize_0_1(hourly["spread"])
    hourly["volatility_score"] = _normalize_0_1(hourly["volatility"])

    return hourly[["hour", "spread_score", "volatility_score"]]


def _interpretation(level: str) -> str:
    mapping = {
        "High": "Good opportunity to shift usage",
        "Medium": "Moderate flexibility",
        "Low": "Limited flexibility",
    }
    return mapping.get(level, "Limited flexibility")


def build_flexibility_index(
    load_profiles_path: str | Path,
    market_path: str | Path,
    config: FlexibilityConfig = FlexibilityConfig(),
) -> pd.DataFrame:
    combined_profiles_long = read_combined_profiles(load_profiles_path)
    load_scores = convert_48_slot_to_24_hour_load_scores(combined_profiles_long)

    market_df = read_market_data(market_path)
    market_scores = build_hourly_market_scores(market_df)

    base_hours = pd.DataFrame({"hour": list(range(24))})
    table = base_hours.merge(market_scores, on="hour", how="left").merge(load_scores, on="hour", how="left")

    for col in ["spread_score", "volatility_score", "load_score"]:
        table[col] = table[col].fillna(0.0)

    table["flexibility_index"] = (
        config.spread_weight * table["spread_score"]
        + config.volatility_weight * table["volatility_score"]
        + config.load_weight * table["load_score"]
    )
    table["flexibility_level"] = table["flexibility_index"].map(_flexibility_level)
    table["interpretation"] = table["flexibility_level"].map(_interpretation)

    return table[
        [
            "hour",
            "spread_score",
            "volatility_score",
            "load_score",
            "flexibility_index",
            "flexibility_level",
            "interpretation",
        ]
    ].sort_values("hour", ignore_index=True)


def build_flexibility_summary(flexibility_table: pd.DataFrame) -> pd.DataFrame:
    top_3 = flexibility_table.nlargest(3, "flexibility_index").copy()
    top_3["summary_group"] = "Top 3"

    bottom_3 = flexibility_table.nsmallest(3, "flexibility_index").copy()
    bottom_3["summary_group"] = "Bottom 3"

    summary = pd.concat([top_3, bottom_3], ignore_index=True)
    summary = summary[
        [
            "summary_group",
            "hour",
            "flexibility_index",
            "flexibility_level",
            "interpretation",
            "spread_score",
            "volatility_score",
            "load_score",
        ]
    ]
    return summary


def export_flexibility_index(output_table: pd.DataFrame, output_path: str | Path) -> None:
    output_path = Path(output_path)
    summary_table = build_flexibility_summary(output_table)
    with pd.ExcelWriter(output_path, engine="openpyxl") as writer:
        output_table.to_excel(writer, sheet_name="flexibility_index", index=False)
        summary_table.to_excel(writer, sheet_name="flexibility_summary", index=False)


def main() -> None:
    base = Path(__file__).resolve().parent
    load_profiles_path = get_data_file_path(base, "task2_load_profiles.xlsx")
    market_path = get_data_file_path(base, "full_year_halfhour_profile.csv")
    output_path = get_data_file_path(base, "flexibility_index_results.xlsx")

    results = build_flexibility_index(
        load_profiles_path=load_profiles_path,
        market_path=market_path,
    )
    export_flexibility_index(results, output_path)

    print(f"Computed flexibility index for {len(results)} hours")
    print(f"Output: {output_path}")


if __name__ == "__main__":
    main()
