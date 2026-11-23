"""Road routing using the OSRM-compatible public routing API."""
import json
import math
import os
import re
import urllib.parse
import urllib.request


ROUTING_ENDPOINT = os.environ.get(
    "FIESTA_ROUTING_URL", "https://router.project-osrm.org/route/v1/driving"
).rstrip("/")


def _validated_coordinate_pair(latitude, longitude):
    try:
        latitude = float(latitude)
        longitude = float(longitude)
    except (TypeError, ValueError):
        return None
    if (
        not math.isfinite(latitude)
        or not math.isfinite(longitude)
        or not -90 <= latitude <= 90
        or not -180 <= longitude <= 180
    ):
        return None
    return latitude, longitude


def _parse_coordinate_pair_text(value):
    text = re.sub(r"```|`", "", str(value or "")).strip()
    text = re.sub(
        r"(?is)^.*?coordenadas(?:\s+para\s+copiar)?\s*:\s*", "", text
    ).strip().strip("()[] ")
    match = re.fullmatch(
        r"([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*(?:,|;|\s)\s*"
        r"([+-]?(?:\d+(?:\.\d*)?|\.\d+))",
        text,
    )
    return _validated_coordinate_pair(*match.groups()) if match else None


def parse_location_coordinates(value):
    """Parse a latitude/longitude pair or a map URL pasted into search."""
    text = str(value or "").strip()
    if not text:
        return None

    url_text = text if "://" in text else "https://" + text
    try:
        parsed_url = urllib.parse.urlsplit(url_text)
        params = urllib.parse.parse_qs(parsed_url.query)
        latitude = params.get("mlat", params.get("lat", [None]))[0]
        longitude = params.get("mlon", params.get("lon", [None]))[0]
        if latitude is not None and longitude is not None:
            result = _validated_coordinate_pair(latitude, longitude)
            if result:
                return result

        query_point = params.get("q", params.get("query", [None]))[0]
        if query_point:
            result = _parse_coordinate_pair_text(query_point)
            if result:
                return result

        coordinate_matches = (
            re.search(r"@([+-]?\d+(?:\.\d+)?),\s*([+-]?\d+(?:\.\d+)?)", text),
            re.search(
                r"(?:^|[#&])map=\d+/([+-]?\d+(?:\.\d+)?)/([+-]?\d+(?:\.\d+)?)",
                parsed_url.fragment,
            ),
        )
        for match in coordinate_matches:
            if match:
                result = _validated_coordinate_pair(*match.groups())
                if result:
                    return result
    except ValueError:
        pass

    return _parse_coordinate_pair_text(text)


def openstreetmap_location_url(latitude, longitude):
    latitude = float(latitude)
    longitude = float(longitude)
    if (
        not math.isfinite(latitude)
        or not math.isfinite(longitude)
        or not -90 <= latitude <= 90
        or not -180 <= longitude <= 180
    ):
        raise ValueError("Las coordenadas de entrega no son válidas.")
    return (
        "https://www.openstreetmap.org/?mlat={0:.6f}&mlon={1:.6f}"
        "#map=18/{0:.6f}/{1:.6f}"
    ).format(latitude, longitude)


def shortest_road_route(origin, destination):
    coordinates = []
    for latitude, longitude in (origin, destination):
        latitude = float(latitude)
        longitude = float(longitude)
        if (
            not math.isfinite(latitude)
            or not math.isfinite(longitude)
            or not -90 <= latitude <= 90
            or not -180 <= longitude <= 180
        ):
            raise ValueError("Las coordenadas de la ruta no son válidas.")
        coordinates.append((latitude, longitude))

    start_lat, start_lng = coordinates[0]
    end_lat, end_lng = coordinates[1]
    query = urllib.parse.urlencode({
        "alternatives": 3,
        "overview": "full",
        "geometries": "geojson",
        "steps": "false",
    })
    url = (
        f"{ROUTING_ENDPOINT}/{start_lng},{start_lat};{end_lng},{end_lat}?{query}"
    )
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "FiestaApp/1.0", "Accept": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=15) as response:
        payload = json.load(response)

    routes = payload.get("routes", []) if payload.get("code") == "Ok" else []
    valid_routes = []
    for route in routes:
        try:
            distance_m = float(route["distance"])
            raw_coordinates = route["geometry"]["coordinates"]
            points = [(float(lat), float(lng)) for lng, lat in raw_coordinates]
        except (KeyError, TypeError, ValueError):
            continue
        if (
            math.isfinite(distance_m)
            and distance_m >= 0
            and len(points) >= 2
            and all(
                math.isfinite(lat)
                and math.isfinite(lng)
                and -90 <= lat <= 90
                and -180 <= lng <= 180
                for lat, lng in points
            )
        ):
            valid_routes.append((distance_m, points))

    if not valid_routes:
        raise ValueError("El servicio no encontró una ruta vial entre esos puntos.")

    distance_m, points = min(valid_routes, key=lambda route: route[0])
    return {"distance_m": distance_m, "coordinates": points}