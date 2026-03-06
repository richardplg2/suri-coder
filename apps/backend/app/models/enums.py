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
    running = "running"
    completed = "completed"
    failed = "failed"
    skipped = "skipped"


class SessionStatus(str, enum.Enum):
    running = "running"
    completed = "completed"
    failed = "failed"
    cancelled = "cancelled"
