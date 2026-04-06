from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, Optional

import pandas as pd


def get_data_file_path(base_folder: str | Path, filename: str) -> Path:
    base = Path(base_folder)
    return base / "data" / filename


PEAK_HOURS = [17, 18]
NIGHT_HOURS = [23, 0, 1, 2, 3, 4, 5, 6, 7]
DAY_HOURS = [hour for hour in range(24) if hour not in set(PEAK_HOURS) | set(NIGHT_HOURS)]


@dataclass(frozen=True)
class EnergyPlan:
    provider_name: str
    meter_type: str
    tariff_name: str
    reversion_tariff_name: str
    standing_charge_annual: float
    standing_charge_includes_vat: bool
    unit_rates_include_vat: bool
    vat_rate: float
    unit_rates_by_hour: Dict[str, float]
    is_promotional: bool
    promo_duration_months: Optional[int]
    source_verified: bool
    human_verified: bool
    region: str


@dataclass(frozen=True)
class AnnualBillResult:
    provider_name: str
    tariff_name: str
    meter_type: str
    region: str
    mode: str
    year1_energy: float
    year1_standing: float
    year1_total: float
    year2_energy: float
    year2_standing: float
    year2_total: float


def _to_float(value: Any) -> Optional[float]:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        if pd.isna(value):
            return None
        return float(value)

    text = str(value).strip()
    if text == "":
        return None

    lowered = text.lower()
    if lowered in {"null", "none", "nan", "na", "not applicable", "not mentioned"}:
        return None

    cleaned = text.replace(",", "").replace("%", "")
    try:
        return float(cleaned)
    except ValueError:
        return None


def _to_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)

    text = str(value).strip().lower()
    return text in {"true", "t", "1", "yes", "y"}


def _normalize_vat_rate(vat_rate_raw: Any) -> float:
    vat = _to_float(vat_rate_raw)
    if vat is None:
        return 0.0
    return vat / 100.0 if vat > 1 else vat


def _normalize_standing_charge(amount: Optional[float], period: str) -> float:
    if amount is None:
        return 0.0

    period_key = (period or "yearly").strip().lower()
    multipliers = {
        "year": 1,
        "yearly": 1,
        "annual": 1,
        "month": 12,
        "monthly": 12,
        "quarter": 4,
        "quarterly": 4,
        "week": 52,
        "weekly": 52,
        "day": 365,
        "daily": 365,
    }
    factor = multipliers.get(period_key, 1)
    return amount * factor


def _rate_to_eur_per_kwh(raw_rate: float) -> float:
    # Most source rows are in c/kWh. Values > 2 are treated as cents.
    return raw_rate / 100.0 if raw_rate > 2 else raw_rate


def _component_total(amount: float, includes_vat: bool, vat_rate: float) -> float:
    return amount if includes_vat else amount * (1.0 + vat_rate)


def _extract_hourly_rates(row: pd.Series) -> Dict[str, float]:
    rates: Dict[str, float] = {}
    for hour in range(24):
        key = f"{hour:02d}"
        col = f"rate_time_{hour:02d}"
        value = _to_float(row.get(col))
        rates[key] = 0.0 if value is None else value
    return rates


def _clean_text(value: Any, fallback: str = "") -> str:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return fallback
    return str(value).strip() or fallback


def load_tariffs(csv_path: str | Path, validated_only: bool = True) -> pd.DataFrame:
    df = pd.read_csv(csv_path, low_memory=False)
    df = df.dropna(how="all")

    if validated_only:
        mask = pd.Series([True] * len(df), index=df.index)
        if "source.verified" in df.columns:
            mask &= df["source.verified"].map(_to_bool)
        if "tariffs.human_verification" in df.columns:
            mask &= df["tariffs.human_verification"].map(_to_bool)
        df = df[mask]

    # Keep rows that look like real tariffs.
    df = df[
        df.get("provider_name", pd.Series("", index=df.index)).astype(str).str.strip().ne("")
        & df.get("tariff_name", pd.Series("", index=df.index)).astype(str).str.strip().ne("")
    ]

    return df.reset_index(drop=True)


def build_energy_plan(row: pd.Series, region: str = "urban") -> EnergyPlan:
    region_key = region.lower().strip()
    if region_key not in {"urban", "rural"}:
        raise ValueError("region must be 'urban' or 'rural'")

    standing_urban = _to_float(row.get("standing_charges.urban"))
    standing_rural = _to_float(row.get("standing_charges.rural"))

    if region_key == "urban":
        standing_raw = standing_urban if standing_urban is not None else standing_rural
    else:
        standing_raw = standing_rural if standing_rural is not None else standing_urban

    standing_period = _clean_text(row.get("standing_charge_period"), fallback="yearly")
    annual_standing = _normalize_standing_charge(standing_raw, standing_period)

    promo_months_raw = _to_float(row.get("tariffs.promo_duration_months"))
    promo_months: Optional[int]
    if promo_months_raw is None or promo_months_raw <= 0:
        promo_months = None
    else:
        promo_months = int(round(promo_months_raw))

    return EnergyPlan(
        provider_name=_clean_text(row.get("provider_name"), fallback="Unknown"),
        meter_type=_clean_text(row.get("Meter_Type"), fallback="Unknown"),
        tariff_name=_clean_text(row.get("tariff_name"), fallback="Unknown"),
        reversion_tariff_name=_clean_text(row.get("reversion_tariff_name"), fallback=""),
        standing_charge_annual=annual_standing,
        standing_charge_includes_vat=_to_bool(row.get("standing_charge_includes_vat")),
        unit_rates_include_vat=_to_bool(row.get("tariffs.vat_included")),
        vat_rate=_normalize_vat_rate(row.get("vat_rate")),
        unit_rates_by_hour=_extract_hourly_rates(row),
        is_promotional=_to_bool(row.get("tariffs.is_promotional")),
        promo_duration_months=promo_months,
        source_verified=_to_bool(row.get("source.verified")),
        human_verified=_to_bool(row.get("tariffs.human_verification")),
        region=region_key,
    )


def load_energy_plans(
    csv_path: str | Path,
    region: str = "urban",
    validated_only: bool = True,
) -> list[EnergyPlan]:
    df = load_tariffs(csv_path=csv_path, validated_only=validated_only)
    return [build_energy_plan(row, region=region) for _, row in df.iterrows()]


def _hourly_weights_from_48_slot_shares(slot_shares: Dict[int, float] | Iterable[float]) -> Dict[str, float]:
    if isinstance(slot_shares, dict):
        shares_by_slot = {int(k): float(v) for k, v in slot_shares.items()}
    else:
        values = [float(v) for v in slot_shares]
        shares_by_slot = {idx + 1: val for idx, val in enumerate(values)}

    weights = {f"{h:02d}": 0.0 for h in range(24)}
    for slot in range(1, 49):
        slot_share = shares_by_slot.get(slot, 0.0)
        hour = (slot - 1) // 2
        weights[f"{hour:02d}"] += slot_share

    total = sum(weights.values())
    if total > 0:
        weights = {h: w / total for h, w in weights.items()}
    return weights


def _band_weights(percentages: Dict[str, float]) -> Dict[str, float]:
    day = float(percentages.get("day", 0.0))
    night = float(percentages.get("night", 0.0))
    peak = float(percentages.get("peak", 0.0))
    total = day + night + peak

    if total <= 0:
        raise ValueError("Band percentages must sum to a positive number")

    if total > 1.5:
        day, night, peak = day / 100.0, night / 100.0, peak / 100.0

    total = day + night + peak
    return {
        "day": day / total,
        "night": night / total,
        "peak": peak / total,
    }


def _average_rate_for_hours(plan: EnergyPlan, hours: list[int]) -> float:
    if not hours:
        return 0.0
    rates = [_rate_to_eur_per_kwh(plan.unit_rates_by_hour[f"{h:02d}"]) for h in hours]
    return sum(rates) / len(rates)


def _calculate_single_period_bill(
    plan: EnergyPlan,
    annual_kwh: float,
    mode: str,
    standing_factor: float,
    slot_shares_48: Optional[Dict[int, float] | Iterable[float]],
    band_percentages: Optional[Dict[str, float]],
) -> tuple[float, float, float]:
    mode_key = mode.lower().strip()

    if mode_key == "hourly":
        if slot_shares_48 is None:
            raise ValueError("hourly mode requires slot_shares_48")
        hourly_weights = _hourly_weights_from_48_slot_shares(slot_shares_48)
        ex_or_inc_energy = 0.0
        for hour in range(24):
            key = f"{hour:02d}"
            hour_kwh = annual_kwh * hourly_weights[key]
            rate = _rate_to_eur_per_kwh(plan.unit_rates_by_hour[key])
            ex_or_inc_energy += hour_kwh * rate

    elif mode_key == "band":
        if band_percentages is None:
            raise ValueError("band mode requires band_percentages")
        weights = _band_weights(band_percentages)
        day_kwh = annual_kwh * weights["day"]
        night_kwh = annual_kwh * weights["night"]
        peak_kwh = annual_kwh * weights["peak"]

        day_rate = _average_rate_for_hours(plan, DAY_HOURS)
        night_rate = _average_rate_for_hours(plan, NIGHT_HOURS)
        peak_rate = _average_rate_for_hours(plan, PEAK_HOURS)

        ex_or_inc_energy = (day_kwh * day_rate) + (night_kwh * night_rate) + (peak_kwh * peak_rate)

    else:
        raise ValueError("mode must be 'hourly' or 'band'")

    ex_or_inc_standing = plan.standing_charge_annual * standing_factor
    final_energy = _component_total(ex_or_inc_energy, plan.unit_rates_include_vat, plan.vat_rate)
    final_standing = _component_total(
        ex_or_inc_standing,
        plan.standing_charge_includes_vat,
        plan.vat_rate,
    )
    return final_energy, final_standing, final_energy + final_standing


def calculate_annual_bill(
    plan: EnergyPlan,
    annual_kwh: float,
    mode: str,
    slot_shares_48: Optional[Dict[int, float] | Iterable[float]] = None,
    band_percentages: Optional[Dict[str, float]] = None,
    post_promo_plan: Optional[EnergyPlan] = None,
) -> AnnualBillResult:
    if annual_kwh < 0:
        raise ValueError("annual_kwh must be non-negative")

    promo_months = plan.promo_duration_months if plan.is_promotional else None

    if promo_months and post_promo_plan is not None:
        promo_fraction = max(0.0, min(12.0, float(promo_months))) / 12.0
        non_promo_fraction = 1.0 - promo_fraction

        p_energy, p_standing, _ = _calculate_single_period_bill(
            plan=plan,
            annual_kwh=annual_kwh * promo_fraction,
            mode=mode,
            standing_factor=promo_fraction,
            slot_shares_48=slot_shares_48,
            band_percentages=band_percentages,
        )
        np_energy, np_standing, _ = _calculate_single_period_bill(
            plan=post_promo_plan,
            annual_kwh=annual_kwh * non_promo_fraction,
            mode=mode,
            standing_factor=non_promo_fraction,
            slot_shares_48=slot_shares_48,
            band_percentages=band_percentages,
        )
        year1_energy = p_energy + np_energy
        year1_standing = p_standing + np_standing

        year2_energy, year2_standing, _ = _calculate_single_period_bill(
            plan=post_promo_plan,
            annual_kwh=annual_kwh,
            mode=mode,
            standing_factor=1.0,
            slot_shares_48=slot_shares_48,
            band_percentages=band_percentages,
        )
    else:
        year1_energy, year1_standing, _ = _calculate_single_period_bill(
            plan=plan,
            annual_kwh=annual_kwh,
            mode=mode,
            standing_factor=1.0,
            slot_shares_48=slot_shares_48,
            band_percentages=band_percentages,
        )
        year2_energy = year1_energy
        year2_standing = year1_standing

    year1_total = year1_energy + year1_standing
    year2_total = year2_energy + year2_standing

    return AnnualBillResult(
        provider_name=plan.provider_name,
        tariff_name=plan.tariff_name,
        meter_type=plan.meter_type,
        region=plan.region,
        mode=mode,
        year1_energy=year1_energy,
        year1_standing=year1_standing,
        year1_total=year1_total,
        year2_energy=year2_energy,
        year2_standing=year2_standing,
        year2_total=year2_total,
    )


def find_post_promo_plan(plans: list[EnergyPlan], promo_plan: EnergyPlan) -> Optional[EnergyPlan]:
    provider = promo_plan.provider_name.casefold()
    meter_type = promo_plan.meter_type.casefold()

    non_promo_same_provider_meter = [
        p
        for p in plans
        if not p.is_promotional
        and p.provider_name.casefold() == provider
        and p.meter_type.casefold() == meter_type
    ]

    reversion_name = promo_plan.reversion_tariff_name.strip().casefold()
    if reversion_name:
        exact_reversion = [
            p for p in non_promo_same_provider_meter if p.tariff_name.strip().casefold() == reversion_name
        ]
        if exact_reversion:
            return exact_reversion[0]

    same_name = [
        p
        for p in non_promo_same_provider_meter
        if p.tariff_name.strip().casefold() == promo_plan.tariff_name.strip().casefold()
    ]
    if same_name:
        return same_name[0]

    return non_promo_same_provider_meter[0] if non_promo_same_provider_meter else None


def _example_uniform_slot_shares() -> Dict[int, float]:
    return {slot: 1.0 / 48.0 for slot in range(1, 49)}


def _example_band_percentages() -> Dict[str, float]:
    return {"day": 55.0, "night": 30.0, "peak": 15.0}


def main() -> None:
    base = Path(__file__).resolve().parent
    csv_path = get_data_file_path(base, "Tarrifs_validated.csv")

    plans = load_energy_plans(csv_path=csv_path, region="urban", validated_only=True)
    if not plans:
        print("No plans found after validation filters")
        return

    sample_plan = plans[0]
    post_promo = find_post_promo_plan(plans, sample_plan)

    hourly_result = calculate_annual_bill(
        plan=sample_plan,
        annual_kwh=4200.0,
        mode="hourly",
        slot_shares_48=_example_uniform_slot_shares(),
        post_promo_plan=post_promo,
    )
    band_result = calculate_annual_bill(
        plan=sample_plan,
        annual_kwh=4200.0,
        mode="band",
        band_percentages=_example_band_percentages(),
        post_promo_plan=post_promo,
    )

    print(f"Sample plan: {sample_plan.provider_name} | {sample_plan.tariff_name}")
    print(
        f"Hourly mode -> year1 EUR {hourly_result.year1_total:.2f}, "
        f"year2 EUR {hourly_result.year2_total:.2f}"
    )
    print(
        f"Band mode   -> year1 EUR {band_result.year1_total:.2f}, "
        f"year2 EUR {band_result.year2_total:.2f}"
    )


if __name__ == "__main__":
    main()

