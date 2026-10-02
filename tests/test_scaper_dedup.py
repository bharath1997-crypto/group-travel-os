"""Dedup rules against the real Orlando cases recorded in Scaper_Dedup_Spec.md §1."""
from __future__ import annotations

import dataclasses

import uuid
from datetime import datetime, timedelta, timezone

from scaper.dedup import (
    EventRow,
    norm_postcode,
    norm_street,
    norm_title,
    norm_venue,
    plan_duplicates,
    same_show,
    same_venue_address,
    same_venue_name,
)

T0 = datetime(2026, 10, 4, 23, 0, tzinfo=timezone.utc)
CONDUIT = uuid.uuid4()
CELINE = uuid.uuid4()


def _row(title: str, venue: str, place: uuid.UUID | None, *, minutes: int = 0, provider: str = "ticketmaster",
         price: float | None = None, image: str | None = None, end: bool = False, status: str = "scheduled",
         seen: int = 0, lat: float = 28.55, lng: float = -81.36) -> EventRow:
    start = T0 + timedelta(minutes=minutes)
    return EventRow(
        id=uuid.uuid4(), provider=provider, title=title, venue_name=venue, venue_place_id=place,
        lat=lat, lng=lng, start_time=start, end_time=start + timedelta(hours=3) if end else None,
        price_min=price, image_url=image, first_seen_at=T0 - timedelta(days=seen), status=status,
    )


# ── venue names ───────────────────────────────────────────────────────────

def test_norm_venue_strips_article_and_city() -> None:
    assert norm_venue("The Abbey-Orlando", "orlando") == ("abbey",)
    assert norm_venue("The Abbey", "orlando") == ("abbey",)
    assert norm_venue("Funny Bone Comedy Club - Orlando", "orlando") == ("funny", "bone", "comedy", "club")


def test_same_venue_name_cases_from_orlando() -> None:
    assert same_venue_name("Conduit", "Conduit", "orlando")
    assert same_venue_name("The Abbey-Orlando", "The Abbey", "orlando")
    assert not same_venue_name("Hard Rock Live Orlando", "Hard Rock Cafe", "orlando")
    assert not same_venue_name("Framework", "Framework Craft Coffee House", "orlando")  # 1-word containment
    assert same_venue_name("Plaza Live", "The Plaza Live Theatre", "orlando")  # 2-word containment
    assert not same_venue_name("Orlando", "Orlando", "orlando")  # nothing left after stripping


# ── titles ────────────────────────────────────────────────────────────────

def test_norm_title_and_headliner_containment() -> None:
    a = norm_title('Joey Cash "Poser Tour"', "Conduit", "orlando")
    b = norm_title("Joey Cash in Orlando", "Conduit", "orlando")
    assert (a, b) == (("joey", "cash", "poser"), ("joey", "cash"))
    assert same_show(a, b)


def test_different_rooms_same_club_are_distinct() -> None:
    a = norm_title("OMRI. @ CELINE ORLANDO", "Celine Orlando", "orlando")
    b = norm_title("MashBit @ CELINE ORLANDO ROOFTOP", "Celine Orlando", "orlando")
    assert (a, b) == (("omri",), ("mashbit",))
    assert not same_show(a, b)


def test_empty_or_trivial_titles_never_match() -> None:
    assert not same_show((), ("x",))
    assert not same_show(("dj",), ("dj",))  # no token of 3+ chars


# ── clustering ────────────────────────────────────────────────────────────

def test_joey_cash_pair_hides_one_and_omri_pair_stays() -> None:
    joey_a = _row('Joey Cash "Poser Tour"', "Conduit", CONDUIT, price=15)
    joey_b = _row("Joey Cash in Orlando", "Conduit", CONDUIT)
    omri = _row("OMRI. @ CELINE ORLANDO", "Celine Orlando", CELINE, provider="eventbrite")
    mash = _row("MashBit @ CELINE ORLANDO ROOFTOP", "Celine Orlando", CELINE, provider="eventbrite", minutes=20)
    plan = plan_duplicates([joey_a, joey_b, omri, mash], "orlando")
    assert plan == {joey_a.id: None, joey_b.id: joey_a.id, omri.id: None, mash.id: None}


def test_duplicate_window_and_distance_limits() -> None:
    # Non-identical titles: only the ±30 min headliner rule can join them.
    a = _row("Indie Night", "Hall", None)
    later = _row("Indie Night Encore", "Hall", None, minutes=31)
    far = _row("Indie Night Encore", "Hall", None, lat=28.56)  # ~1.1 km away, no shared place
    assert all(v is None for v in plan_duplicates([a, later, far], "orlando").values())
    near = _row("Indie Night Encore", "Hall", None, minutes=30, lat=28.5505)  # ~55 m
    plan = plan_duplicates([a, near], "orlando")
    assert sorted(v is None for v in plan.values()) == [False, True]


def test_timed_entry_series_is_one_group_per_local_day() -> None:
    title = "Balloon Museum | EmotionAir - Art You Can Feel - Chicago"
    opening = datetime(2026, 10, 3, 15, 0, tzinfo=timezone.utc)  # 10:00 in Chicago

    def slot(minutes: int) -> EventRow:
        row = _row(title, "The Fields Studios", CELINE)
        return dataclasses.replace(row, start_time=opening + timedelta(minutes=minutes), timezone="America/Chicago")

    day1 = [slot(30 * i) for i in range(20)]  # 10:00-19:30 local: 10 h of 30-min slots
    day2 = [slot(24 * 60 + 30 * i) for i in range(4)]
    plan = plan_duplicates(day1 + day2, "chicago")
    groups = {plan[e.id] or e.id for e in day1}
    assert len(groups) == 1  # one card for the whole day, however far apart the slots are
    assert {plan[e.id] or e.id for e in day2}.isdisjoint(groups)  # next day is its own card


def test_series_needs_identical_title_and_same_place() -> None:
    a = _row("Comedy Hour", "Hall", CONDUIT)
    other_show = _row("Late Show", "Hall", CONDUIT, minutes=180)
    elsewhere = _row("Comedy Hour", "Other Hall", CELINE, minutes=180, lat=28.60)
    assert all(v is None for v in plan_duplicates([a, other_show, elsewhere], "orlando").values())


def test_groups_never_span_local_midnight() -> None:
    # 23:50 and 00:10 Chicago time on consecutive days: same show, but different local days.
    late = _row("Indie Night", "Hall", CONDUIT, minutes=0)
    late = dataclasses.replace(late, start_time=datetime(2026, 10, 3, 4, 50, tzinfo=timezone.utc), timezone="America/Chicago")
    early = dataclasses.replace(late, id=uuid.uuid4(), start_time=datetime(2026, 10, 3, 5, 10, tzinfo=timezone.utc))
    assert all(v is None for v in plan_duplicates([late, early], "orlando").values())


def test_completeness_wins_then_ticketmaster_breaks_ties() -> None:
    eb_rich = _row("Indie Night", "Hall", CONDUIT, provider="eventbrite", price=10, image="i", end=True)
    tm_thin = _row("Indie Night", "Hall", CONDUIT, provider="ticketmaster")
    assert plan_duplicates([tm_thin, eb_rich], "orlando")[tm_thin.id] == eb_rich.id

    eb_tie = _row("Indie Night", "Hall", CONDUIT, provider="eventbrite", price=10, seen=5)
    tm_tie = _row("Indie Night", "Hall", CONDUIT, provider="ticketmaster", price=12)
    assert plan_duplicates([eb_tie, tm_tie], "orlando")[eb_tie.id] == tm_tie.id


def test_cancelled_rows_stand_alone() -> None:
    live = _row("Indie Night", "Hall", CONDUIT, provider="eventbrite")
    cancelled = _row("Indie Night", "Hall", CONDUIT, status="cancelled", price=10)
    assert plan_duplicates([live, cancelled], "orlando") == {live.id: None, cancelled.id: None}


def test_three_way_cluster_has_one_canonical() -> None:
    rows = [
        _row("Indie Night", "Hall", CONDUIT, provider="eventbrite"),
        _row("Indie Night Live", "Hall", CONDUIT, price=5, minutes=10),
        _row("Indie Night Tour", "Hall", CONDUIT, minutes=25),
    ]
    plan = plan_duplicates(rows, "orlando")
    assert list(plan.values()).count(None) == 1
    assert {v for v in plan.values() if v} == {rows[1].id}


# ── tier A3: name + street + postcode ─────────────────────────────────────

def test_norm_street_and_postcode_real_abbey_variants() -> None:
    assert norm_street("100 South Eola Drive") == ("100", "s", "eola", "dr")
    assert norm_street("100 S Eola Dr #100") == ("100", "s", "eola", "dr")
    assert norm_street("100 S Eola Dr, Suite 2B") == ("100", "s", "eola", "dr")
    assert norm_postcode("32801") == norm_postcode("32801-3147") == "32801"


def test_same_venue_address_requires_all_three() -> None:
    abbey_tm = ("The Abbey-Orlando", "100 S Eola Dr #100", "32801")
    abbey_ov = ("The Abbey", "100 S Eola Dr", "32801-1234")
    assert same_venue_address(*abbey_tm, *abbey_ov, "orlando")
    assert not same_venue_address("The Abbey", "102 S Eola Dr", "32801", *abbey_ov, "orlando")  # street
    assert not same_venue_address("The Abbey", "100 S Eola Dr", "32803", *abbey_ov, "orlando")  # postcode
    assert not same_venue_address("Eola Lounge", "100 S Eola Dr", "32801", *abbey_ov, "orlando")  # name
    assert not same_venue_address("The Abbey", None, "32801", *abbey_ov, "orlando")  # missing street
