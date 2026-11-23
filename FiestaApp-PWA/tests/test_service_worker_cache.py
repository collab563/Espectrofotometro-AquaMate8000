from pathlib import Path


def test_service_worker_cache_is_bumped_for_frontend_updates():
    service_worker = Path(__file__).resolve().parents[1] / "mobile_assets" / "service-worker.js"
    content = service_worker.read_text(encoding="utf-8")

    assert 'CACHE_NAME = "fiestaapp-pwa-v15"' in content
