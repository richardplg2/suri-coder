## ADDED Requirements

### Requirement: User registration
The system SHALL allow new users to register with email, name, and password. Email MUST be unique. Password MUST be hashed with bcrypt before storage.

#### Scenario: Successful registration
- **WHEN** a POST request is sent to `/auth/register` with valid email, name, and password
- **THEN** the system creates a new User record and returns the user data with a JWT access token

#### Scenario: Duplicate email registration
- **WHEN** a POST request is sent to `/auth/register` with an email that already exists
- **THEN** the system returns HTTP 409 with error message "Email already registered"

### Requirement: User login
The system SHALL authenticate users with email and password, returning a JWT access token on success.

#### Scenario: Successful login
- **WHEN** a POST request is sent to `/auth/login` with valid email and password
- **THEN** the system returns a JWT access token and user data

#### Scenario: Invalid credentials
- **WHEN** a POST request is sent to `/auth/login` with incorrect email or password
- **THEN** the system returns HTTP 401 with error message "Invalid credentials"

### Requirement: Current user endpoint
The system SHALL provide an endpoint to retrieve the currently authenticated user's data.

#### Scenario: Get current user
- **WHEN** a GET request is sent to `/auth/me` with a valid JWT token in the Authorization header
- **THEN** the system returns the authenticated user's data (id, email, name, avatar_url, role)

#### Scenario: Invalid or missing token
- **WHEN** a GET request is sent to `/auth/me` without a token or with an expired/invalid token
- **THEN** the system returns HTTP 401

### Requirement: User roles
The system SHALL support two user roles: `admin` and `member`. New users SHALL default to `member` role.

#### Scenario: Default role assignment
- **WHEN** a new user registers
- **THEN** the user is assigned the `member` role

### Requirement: JWT token format
The system SHALL issue JWT tokens containing the user's `id` as subject claim, with a configurable expiration time.

#### Scenario: Token contains user ID
- **WHEN** a JWT token is decoded
- **THEN** the `sub` claim contains the user's UUID as a string
