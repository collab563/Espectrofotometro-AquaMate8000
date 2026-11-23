import io
import json
from unittest.mock import patch

import routing


def test_parse_copied_whatsapp_coordinate_block():
    copied_text = "📋 Coordenadas para copiar:\n```\n-8.076438, -79.053197\n```"

    assert routing.parse_location_coordinates(copied_text) == (-8.076438, -79.053197)


def test_parse_openstreetmap_location_link():
    link = (
        "https://www.openstreetmap.org/?mlat=-8.076438&mlon=-79.053197"
        "#map=18/-8.076438/-79.053197"
    )

    assert routing.parse_location_coordinates(link) == (-8.076438, -79.053197)


def test_reject_invalid_coordinate_text():
    assert routing.parse_location_coordinates("91, -79") is None
    assert routing.parse_location_coordinates("-8, -181") is None
    assert routing.parse_location_coordinates("Av. España 120, Trujillo") is None


def test_openstreetmap_delivery_link_contains_validated_point():
    assert routing.openstreetmap_location_url(-12.0464, -77.0428) == (
        "https://www.openstreetmap.org/?mlat=-12.046400&mlon=-77.042800"
        "#map=18/-12.046400/-77.042800"
    )


def test_shortest_road_route_chooses_nearest_alternative_and_converts_coordinates():
    payload = {
        "code": "Ok",
        "routes": [
            {"distance": 2800, "geometry": {"coordinates": [[-79.0, -8.0], [-79.1, -8.1]]}},
            {"distance": 2100, "geometry": {"coordinates": [[-79.0, -8.0], [-79.05, -8.05]]}},
        ],
    }
    response = io.BytesIO(json.dumps(payload).encode("utf-8"))

    with patch("routing.urllib.request.urlopen", return_value=response):
        route = routing.shortest_road_route((-8.0, -79.0), (-8.1, -79.1))

    assert route == {"distance_m": 2100, "coordinates": [(-8.0, -79.0), (-8.05, -79.05)]}


def test_shortest_road_route_rejects_invalid_coordinates_before_request():
    with patch("routing.urllib.request.urlopen") as urlopen:
        try:
            routing.shortest_road_route((95, -79.0), (-8.1, -79.1))
        except ValueError as error:
            assert "coordenadas" in str(error)
        else:
            raise AssertionError("Invalid coordinates must be rejected")

    urlopen.assert_not_called()