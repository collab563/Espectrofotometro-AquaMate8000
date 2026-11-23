import math

from main import haversine_km


def test_haversine_km_same_point():
    assert haversine_km(-12.0864, -77.0358, -12.0864, -77.0358) == 0.0


def test_haversine_km_known_distance():
    # Aproximadamente 1 km de diferencia en latitud
    d = haversine_km(-12.0864, -77.0358, -12.0764, -77.0358)
    assert 0.9 <= d <= 1.2


def test_haversine_km_large_distance():
    d = haversine_km(-12.0864, -77.0358, -13.0864, -77.0358)
    assert d > 90
