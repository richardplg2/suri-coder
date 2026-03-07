import pytest

from app.models.enums import WsChannel, WsEvent


@pytest.mark.asyncio
async def test_notifications_channel_exists():
    """WsChannel.notifications must be defined."""
    assert hasattr(WsChannel, "notifications")
    assert WsChannel.notifications.value == "notifications"


@pytest.mark.asyncio
async def test_new_notification_event_exists():
    """WsEvent.new_notification must be defined."""
    assert hasattr(WsEvent, "new_notification")
    assert WsEvent.new_notification.value == "new_notification"


@pytest.mark.asyncio
async def test_notifications_channel_in_redis_key_map():
    """The notifications channel must be mapped in CHANNEL_TO_REDIS_KEY."""
    from app.services.ws_manager import CHANNEL_TO_REDIS_KEY

    assert WsChannel.notifications in CHANNEL_TO_REDIS_KEY
    key_fn = CHANNEL_TO_REDIS_KEY[WsChannel.notifications]
    assert key_fn({"user_id": "abc-123"}) == "notifications:abc-123"
