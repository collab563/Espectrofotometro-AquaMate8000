import io
import json
from types import SimpleNamespace
import urllib.parse
from unittest.mock import Mock, patch

from PyQt6.QtCore import QDateTime
from PyQt6.QtPositioning import QGeoCoordinate, QGeoPositionInfo

import main


def test_address_search_limits_results_to_peru_and_rejects_bad_coordinates():
    response = io.BytesIO(json.dumps({"features": [
        {
            "properties": {
                "name": "La Esperanza",
                "city": "Trujillo",
                "state": "La Libertad",
                "country": "Peru",
                "countrycode": "pe",
            },
            "geometry": {"coordinates": [-79.06, -8.06]},
        },
        {
            "properties": {"name": "Foreign place", "countrycode": "VE"},
            "geometry": {"coordinates": [-70.0, 9.0]},
        },
        {
            "properties": {"name": "Invalid location", "countrycode": "PE"},
            "geometry": {"coordinates": [500, 0]},
        },
    ]}).encode("utf-8"))

    with patch("main.urllib.request.urlopen", return_value=response) as urlopen:
        results = main.search_address_candidates("La Esperanza, Trujillo")

    request = urlopen.call_args.args[0]
    params = urllib.parse.parse_qs(urllib.parse.urlparse(request.full_url).query)
    assert params["countrycode"] == ["PE"]
    assert params["limit"] == ["10"]
    assert request.get_header("User-agent").startswith("FiestaApp/")
    assert request.get_header("Accept-language") == "es"
    assert request.full_url.startswith("https://photon.komoot.io/api/")
    assert results == [("La Esperanza, Trujillo, La Libertad, Peru", -8.06, -79.06, None)]


def test_address_search_skips_queries_shorter_than_two_characters():
    with patch("main.urllib.request.urlopen") as urlopen:
        assert main.search_address_candidates("  x ") == []
    urlopen.assert_not_called()


def test_address_search_accepts_two_character_prefixes():
    response = io.BytesIO(json.dumps({"features": []}).encode("utf-8"))

    with patch("main.urllib.request.urlopen", return_value=response) as urlopen:
        assert main.search_address_candidates(" Tr ") == []

    params = urllib.parse.parse_qs(urllib.parse.urlparse(urlopen.call_args.args[0].full_url).query)
    assert params["q"] == ["Tr"]


def test_address_search_returns_coordinates_without_calling_photon():
    with patch("main.urllib.request.urlopen") as urlopen:
        candidates = main.search_address_candidates("-8.076438, -79.053197")

    assert candidates == [
        ("Coordenadas: -8.076438, -79.053197", -8.076438, -79.053197, 0)
    ]
    urlopen.assert_not_called()


def test_address_suggestions_match_words_in_any_order_case_and_accent_insensitively():
    candidates = [
        ("Estadio Manuel C. Dulanto, Callao", -12.1, -77.1, None),
        ("Estadio Manuel de la Cruz, Pimentel", -8.2, -79.1, None),
        ("Estadio Municipal, Trujillo", -8.3, -79.2, None),
    ]

    assert main.filter_address_candidates_by_prefix(candidates, "manuel estadio") == candidates[:2]
    assert main.filter_address_candidates_by_prefix(candidates, "estadio man") == candidates[:2]
    assert main.filter_address_candidates_by_prefix(
        [("Ávila, Perú", -8.0, -79.0, None)], "avila"
    ) == [("Ávila, Perú", -8.0, -79.0, None)]


def test_address_query_can_reuse_results_when_refining_reordering_or_shortening_words():
    assert main.address_query_can_reuse_results("estadio", "estadio man")
    assert main.address_query_can_reuse_results("estadio manuel", "manuel estadio")
    assert main.address_query_can_reuse_results("estadio manuel", "estadio man")
    assert not main.address_query_can_reuse_results("estadio", "mercado")


def test_location_accuracy_rejects_the_windows_network_estimate():
    assert main.location_accuracy_is_acceptable(10_000)
    assert not main.location_accuracy_is_acceptable(200_000)
    assert not main.location_accuracy_is_acceptable(float("nan"))
    assert not main.location_accuracy_is_acceptable(None)


def test_position_handler_rejects_imprecise_windows_location():
    position = QGeoPositionInfo(
        QGeoCoordinate(-12.046, -77.0305),
        QDateTime.currentDateTimeUtc(),
    )
    position.setAttribute(QGeoPositionInfo.Attribute.HorizontalAccuracy, 200_000)
    location_status = Mock()
    app = SimpleNamespace(
        location_request_pending=True,
        location_status=location_status,
        status=Mock(),
        user_location=None,
    )

    main.FiestaApp._on_position_updated(app, position)

    assert app.location_request_pending is False
    assert app.user_location is None
    assert "±200 km" in location_status.setText.call_args.args[0]
    app.status.showMessage.assert_called_once()