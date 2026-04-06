from __future__ import annotations

from pathlib import Path
from typing import Dict, Tuple

import pandas as pd

from flexibility_engine import FlexibilityConfig, build_hourly_market_scores, read_market_data
from tariff_engine import calculate_annual_bill, find_post_promo_plan, load_energy_plans


def get_data_file_path(base_folder: str | Path, filename: str) -> Path:
    base = Path(base_folder)
    return base / "data" / filename


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


def load_selected_profile(
    load_profiles_path: str | Path,
    occupancy_group: str,
    dwelling_group: str,
) -> Tuple[pd.DataFrame, Dict[int, float]]:
    combined = pd.read_excel(load_profiles_path, sheet_name="combined_profiles_long")

    selected = combined[
        (combined["occupancy_group"] == occupancy_group)
        & (combined["dwelling_group"] == dwelling_group)
    ].copy()

    if selected.empty:
        raise ValueError(f"No profile found for occupancy_group={occupancy_group}, dwelling_group={dwelling_group}")

    selected["slot"] = pd.to_numeric(selected["slot"], errors="coerce")
    selected["final_share"] = pd.to_numeric(selected["final_share"], errors="coerce")
    selected = selected.dropna(subset=["slot", "final_share"])
    selected["slot"] = selected["slot"].astype(int)
    selected = selected[selected["slot"].between(1, 48)].sort_values("slot", ignore_index=True)

    slot_shares_48 = {int(row.slot): float(row.final_share) for row in selected[["slot", "final_share"]].itertuples(index=False)}
    return selected, slot_shares_48


def build_tariff_results(
    tariffs_csv_path: str | Path,
    slot_shares_48: Dict[int, float],
    annual_kwh: float,
    region: str = "urban",
) -> pd.DataFrame:
    plans = load_energy_plans(csv_path=tariffs_csv_path, region=region, validated_only=True)

    rows = []
    for plan in plans:
        post_promo_plan = find_post_promo_plan(plans, plan) if plan.is_promotional else None
        bill = calculate_annual_bill(
            plan=plan,
            annual_kwh=annual_kwh,
            mode="hourly",
            slot_shares_48=slot_shares_48,
            post_promo_plan=post_promo_plan,
        )
        rows.append(
            {
                "provider_name": bill.provider_name,
                "tariff_name": bill.tariff_name,
                "meter_type": bill.meter_type,
                "region": bill.region,
                "mode": bill.mode,
                "year1_total": bill.year1_total,
                "year2_total": bill.year2_total,
            }
        )

    results = pd.DataFrame(rows)
    results = results.sort_values(
        by=["year1_total", "year2_total", "provider_name", "tariff_name"],
        ascending=True,
        ignore_index=True,
    )
    results["rank"] = range(1, len(results) + 1)

    best_cost = float(results.loc[0, "year1_total"]) if not results.empty else 0.0
    results["savings_vs_best"] = best_cost - results["year1_total"]

    return results


def build_market_signal_summary(market_path: str | Path) -> Tuple[pd.DataFrame, pd.DataFrame]:
    market_raw = pd.read_csv(market_path) if str(market_path).lower().endswith(".csv") else pd.read_excel(market_path)

    expected_cols = [
        "half_hour",
        "dam_price",
        "target_settlement",
        "spread",
        "dam_price/kwh",
        "target_settlement/kwh",
        "spread/kwh",
    ]
    available_cols = [c for c in expected_cols if c in market_raw.columns]
    market_selected = market_raw[available_cols].copy()

    for col in available_cols:
        market_selected[col] = pd.to_numeric(market_selected[col], errors="coerce")

    market_selected = market_selected.dropna(subset=["half_hour", "spread/kwh"])
    market_selected["half_hour"] = market_selected["half_hour"].astype(int)
    market_selected = market_selected[market_selected["half_hour"].between(0, 47)]
    market_selected["hour"] = market_selected["half_hour"] // 2

    # Defendable volatility: std of spread/kwh by hour across half-hour observations.
    hourly_vol = market_selected.groupby("hour", as_index=False).agg(
        hourly_spread_std=("spread/kwh", lambda s: s.std(ddof=0))
    )
    hourly_vol["hourly_spread_std"] = pd.Series(
        pd.to_numeric(hourly_vol["hourly_spread_std"], errors="coerce"),
        index=hourly_vol.index,
    ).fillna(0.0)

    summary = pd.DataFrame(
        {
            "metric": [
                "avg_dam_price_kwh",
                "avg_target_settlement_kwh",
                "avg_spread_kwh",
                "std_spread_kwh_overall",
                "mean_hourly_spread_volatility",
                "max_spread_kwh",
                "min_spread_kwh",
            ],
            "value": [
                float(market_selected["dam_price/kwh"].mean()) if "dam_price/kwh" in market_selected else 0.0,
                float(market_selected["target_settlement/kwh"].mean()) if "target_settlement/kwh" in market_selected else 0.0,
                float(market_selected["spread/kwh"].mean()),
                float(market_selected["spread/kwh"].std(ddof=0)),
                float(hourly_vol["hourly_spread_std"].mean()),
                float(market_selected["spread/kwh"].max()),
                float(market_selected["spread/kwh"].min()),
            ],
        }
    )

    return market_selected, summary


def build_flexibility_results(
    selected_profile: pd.DataFrame,
    market_path: str | Path,
    config: FlexibilityConfig = FlexibilityConfig(),
) -> pd.DataFrame:
    profile_hour = selected_profile[["slot", "final_share"]].copy()
    profile_hour["hour"] = (profile_hour["slot"] - 1) // 2
    hourly_load = profile_hour.groupby("hour", as_index=False).agg(hour_share=("final_share", "sum"))
    hourly_load["load_score"] = _normalize_0_1(hourly_load["hour_share"])

    market_df = read_market_data(market_path)
    market_scores = build_hourly_market_scores(market_df)

    table = (
        pd.DataFrame({"hour": list(range(24))})
        .merge(market_scores, on="hour", how="left")
        .merge(hourly_load[["hour", "load_score"]], on="hour", how="left")
    )

    for col in ["spread_score", "volatility_score", "load_score"]:
        table[col] = table[col].fillna(0.0)

    table["flexibility_index"] = (
        config.spread_weight * table["spread_score"]
        + config.volatility_weight * table["volatility_score"]
        + config.load_weight * table["load_score"]
    )
    table["flexibility_level"] = table["flexibility_index"].map(_flexibility_level)

    return table[
        [
            "hour",
            "spread_score",
            "volatility_score",
            "load_score",
            "flexibility_index",
            "flexibility_level",
        ]
    ].sort_values("hour", ignore_index=True)


def build_summary(
    occupancy_group: str,
    dwelling_group: str,
    annual_kwh: float,
    cheapest_plan: pd.DataFrame,
    top_flexible_hours: pd.DataFrame,
) -> pd.DataFrame:
    best_hour = int(top_flexible_hours.iloc[0]["hour"])
    best_index = float(top_flexible_hours.iloc[0]["flexibility_index"])

    recommendation = (
        f"Choose {cheapest_plan.iloc[0]['provider_name']} - {cheapest_plan.iloc[0]['tariff_name']} "
        f"and shift flexible usage to hour {best_hour:02d}:00 where flexibility is highest."
    )

    return pd.DataFrame(
        [
            {
                "occupancy_group": occupancy_group,
                "dwelling_group": dwelling_group,
                "annual_kwh": annual_kwh,
                "cheapest_provider": cheapest_plan.iloc[0]["provider_name"],
                "cheapest_tariff": cheapest_plan.iloc[0]["tariff_name"],
                "cheapest_year1_total": float(cheapest_plan.iloc[0]["year1_total"]),
                "cheapest_year2_total": float(cheapest_plan.iloc[0]["year2_total"]),
                "highest_flexibility_hour": best_hour,
                "highest_flexibility_index": best_index,
                "short_recommendation": recommendation,
            }
        ]
    )


def run_integrated_analysis(
    base_folder: str | Path,
    occupancy_group: str,
    dwelling_group: str,
    annual_kwh: float,
    region: str = "urban",
) -> None:
    base = Path(base_folder)

    load_profiles_path = get_data_file_path(base, "task2_load_profiles.xlsx")
    tariffs_csv_path = get_data_file_path(base, "Tarrifs_validated.csv")
    market_path = get_data_file_path(base, "full_year_halfhour_profile.csv")
    output_path = get_data_file_path(base, "final_integrated_analysis.xlsx")

    selected_profile, slot_shares_48 = load_selected_profile(
        load_profiles_path=load_profiles_path,
        occupancy_group=occupancy_group,
        dwelling_group=dwelling_group,
    )

    tariff_results = build_tariff_results(
        tariffs_csv_path=tariffs_csv_path,
        slot_shares_48=slot_shares_48,
        annual_kwh=annual_kwh,
        region=region,
    )
    cheapest_plan = tariff_results.head(1).copy()

    market_data, market_signal_summary = build_market_signal_summary(market_path)

    flexibility_results = build_flexibility_results(
        selected_profile=selected_profile,
        market_path=market_path,
    )
    top_flexible_hours = flexibility_results.nlargest(3, "flexibility_index").reset_index(drop=True)
    bottom_flexible_hours = flexibility_results.nsmallest(3, "flexibility_index").reset_index(drop=True)

    summary = build_summary(
        occupancy_group=occupancy_group,
        dwelling_group=dwelling_group,
        annual_kwh=annual_kwh,
        cheapest_plan=cheapest_plan,
        top_flexible_hours=top_flexible_hours,
    )

    with pd.ExcelWriter(output_path, engine="openpyxl") as writer:
        selected_profile.to_excel(writer, sheet_name="selected_profile", index=False)
        tariff_results.to_excel(writer, sheet_name="tariff_results", index=False)
        cheapest_plan.to_excel(writer, sheet_name="cheapest_plan", index=False)
        market_signal_summary.to_excel(writer, sheet_name="market_signal_summary", index=False)
        flexibility_results.to_excel(writer, sheet_name="flexibility_results", index=False)
        top_flexible_hours.to_excel(writer, sheet_name="top_flexible_hours", index=False)
        bottom_flexible_hours.to_excel(writer, sheet_name="bottom_flexible_hours", index=False)
        summary.to_excel(writer, sheet_name="summary", index=False)

    print(f"Output: {output_path}")
    print(
        f"Cheapest plan: {cheapest_plan.iloc[0]['provider_name']} | "
        f"{cheapest_plan.iloc[0]['tariff_name']} | "
        f"EUR {float(cheapest_plan.iloc[0]['year1_total']):.2f}"
    )


def main() -> None:
    base = Path(__file__).resolve().parent
    run_integrated_analysis(
        base_folder=base,
        occupancy_group="3_occ",
        dwelling_group="detached",
        annual_kwh=4200.0,
        region="urban",
    )


if __name__ == "__main__":
    main()

