import enum


class UserRole(str, enum.Enum):
    admin = "admin"
    member = "member"


class TicketType(str, enum.Enum):
    feature = "feature"
    bug = "bug"
    improvement = "improvement"
    chore = "chore"
    spike = "spike"


class TicketStatus(str, enum.Enum):
    backlog = "backlog"
    todo = "todo"
    in_progress = "in_progress"
    in_review = "in_review"
    done = "done"
    cancelled = "cancelled"


class TicketPriority(str, enum.Enum):
    urgent = "urgent"
    high = "high"
    medium = "medium"
    low = "low"
    none = "none"


class StepStatus(str, enum.Enum):
    pending = "pending"
    ready = "ready"
    awaiting_approval = "awaiting_approval"
    running = "running"
    review = "review"
    changes_requested = "changes_requested"
    completed = "completed"
    failed = "failed"
    skipped = "skipped"


class ReviewStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    changes_requested = "changes_requested"


class SessionStatus(str, enum.Enum):
    running = "running"
    completed = "completed"
    failed = "failed"
    cancelled = "cancelled"


class WsAction(str, enum.Enum):
    subscribe = "subscribe"
    unsubscribe = "unsubscribe"
    ping = "ping"


class WsChannel(str, enum.Enum):
    project_tickets = "project:tickets"
    ticket_progress = "ticket:progress"
    session_stream = "session:stream"
    notifications = "notifications"
    brainstorm_session = "brainstorm:session"


class WsEvent(str, enum.Enum):
    # System
    subscribed = "subscribed"
    unsubscribed = "unsubscribed"
    error = "error"
    pong = "pong"

    # project:tickets
    ticket_created = "ticket_created"
    ticket_updated = "ticket_updated"
    step_status_changed = "step_status_changed"

    # ticket:progress
    step_started = "step_started"
    step_completed = "step_completed"
    step_failed = "step_failed"
    step_awaiting_approval = "step_awaiting_approval"
    step_review = "step_review"
    step_changes_requested = "step_changes_requested"
    brainstorm_output = "brainstorm_output"
    workflow_completed = "workflow_completed"

    # notifications
    new_notification = "new_notification"
    unread_count_changed = "unread_count_changed"

    # brainstorm:session
    brainstorm_message = "brainstorm_message"
    brainstorm_quiz = "brainstorm_quiz"
    brainstorm_summary = "brainstorm_summary"

    # session:stream
    message = "message"
    tool_use = "tool_use"
    cost_update = "cost_update"
    completed = "completed"
    failed = "failed"


class SpecType(str, enum.Enum):
    feature = "feature"
    design = "design"
    plan = "plan"
    test = "test"


class SpecRefType(str, enum.Enum):
    derives_from = "derives_from"
    implements = "implements"
    verifies = "verifies"
    relates_to = "relates_to"


class BrainstormMessageType(str, enum.Enum):
    text = "text"
    quiz = "quiz"
    summary = "summary"
    figma_context = "figma_context"


class BrainstormRole(str, enum.Enum):
    user = "user"
    assistant = "assistant"
    system = "system"


class TicketSource(str, enum.Enum):
    ai_brainstorm = "ai_brainstorm"
    figma = "figma"
    manual = "manual"
