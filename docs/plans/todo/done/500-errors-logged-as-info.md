---
status: pending
---

# 500 Response Errors Logged as INFO Level

The server's HTTP logging is showing 500 response code errors at "INFO"
level instead of "ERROR" level. HTTP 5xx responses should be logged at
error level so they stand out in log output and can trigger alerts.

Review the pino/morgan logging configuration and ensure response status
codes >= 500 are logged at the appropriate severity level.
