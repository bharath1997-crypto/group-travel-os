# API Connection Map

This document serves as a permanent reference for the API connections between the Frontend and Backend of the Travello app.

## 1. Backend Endpoints

### Auth
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /auth/oauth/google/start | No | Redirect to Google OAuth |
| GET | /auth/oauth/google/callback | No | Google OAuth callback |
| GET | /auth/oauth/facebook/start | No | Redirect to Facebook OAuth |
| GET | /auth/oauth/facebook/callback | No | Facebook OAuth callback |
| POST | /auth/register | No | Register a new user account |
| POST | /auth/login | No | Login and receive access token |
| POST | /auth/verify-email | No | Verify email using token |
| POST | /auth/resend-verification | No | Resend verification email |
| GET | /auth/me | Yes | Get current user profile |
| PATCH | /auth/me | Yes | Update current user profile |
| POST | /auth/presence | Yes | Record web presence |
| POST | /auth/change-password | Yes | Change current user password |
| POST | /auth/account/deactivate | Yes | Soft-deactivate account |
| POST | /auth/send-verification-email | Yes | Send or resend email verification link |
| GET | /auth/verify-email/confirm | No | Confirm email from inbox link |
| POST | /auth/forgot-password | No | Request a password reset email |
| POST | /auth/reset-password | No | Complete password reset using token |
| POST | /auth/phone/send | No | Send phone OTP |
| POST | /auth/phone/verify | Yes | Verify phone OTP and save number |
| POST | /auth/whatsapp/send | No | Send WhatsApp OTP |
| POST | /auth/whatsapp/verify | Yes | Verify WhatsApp OTP and save number |

### Explore
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /explore/debug-shorts | No | Debug shorts |
| GET | /explore | No | Concurrently fetches YouTube Shorts and News |
| GET | /explore/hashtags | No | Get city hashtags |
| GET | /explore/hero-photo | No | Get hero photo |
| GET | /explore/ticketmaster | No | Get ticketmaster events |
| GET | /explore/places | No | Get places (attractions/restaurants) |
| GET | /explore/gnews | No | Get GNews articles |
| GET | /explore/tips | No | Get travel tips |
| GET | /explore/safety | No | Get safety score |
| GET | /explore/currency | No | Get currency rate |
| GET | /explore/travel-info | Optional | Get travel info bundle |
| GET | /explore/guide | No | Get guide |
| GET | /explore/weather | No | Get weather |
| GET | /explore/music | No | Get music events |
| GET | /explore/podcasts | No | Get podcasts |
| GET | /explore/radio | No | Get radio stations |
| GET | /explore/google-events | No | Get Google events via SerpAPI |
| GET | /explore/eventbrite | No | Get Eventbrite events |
| GET | /explore/seasonal-events-ai | No | Get AI seasonal events |
| GET | /explore/transport | No | Get transport agencies |
| GET | /explore/fallback | No | Universal location fallback |
| GET | /explore/city-scores | No | Get city scores |
| GET | /explore/wiki-summary | No | Get wiki summary |
| DELETE | /explore/cache | Yes (Admin) | Clear explore cache |

### Live
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /live/upcoming-trips | Yes | List upcoming live trips |
| GET | /live/my-active-session | Yes | Get my active live session |
| POST | /live/sessions | Yes | Create live session |
| GET | /live/trips/{trip_id}/session | Yes | Get live session for trip |
| POST | /live/sessions/join-by-code | Yes | Join live by code |
| POST | /live/sessions/{session_id}/join | Yes | Join live session |
| POST | /live/sessions/{session_id}/checklist/accept | Yes | Accept live checklist |
| GET | /live/sessions/{session_id}/checklist | Yes | List live checklist |
| POST | /live/sessions/{session_id}/end | Yes | End live session |
| POST | /live/sessions/{session_id}/coordinator | Yes | Assign coordinator |
| POST | /live/trips/{trip_id}/meet-point | Yes | Set meet point |
| POST | /live/trips/{trip_id}/quick-status | Yes | Set quick status |
| POST | /live/trips/{trip_id}/timer-ended | Yes | Notify timer ended |
| POST | /live/sessions/{session_id}/group-formed | Yes | Notify group formed |

### Groups
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /groups | Yes | Create a new group |
| GET | /groups | Yes | List groups you belong to |
| POST | /groups/join | Yes | Join a group using an invite code |
| GET | /groups/{group_id}/members | Yes | List members of a group |
| GET | /groups/{group_id} | Yes | Get a group by id |
| DELETE | /groups/{group_id}/leave | Yes | Leave the group |
| DELETE | /groups/{group_id} | Yes | Delete the group entirely |
| PATCH | /groups/{group_id}/members/{user_id}/role | Yes (Admin) | Change a member's role |
| GET | /groups/{group_id}/close-check | Yes (Admin) | Unsettled-balance count before closing |
| DELETE | /groups/{group_id}/members/{user_id} | Yes | Remove a member from the group |
| POST | /groups/{group_id}/invite/regenerate | Yes (Admin) | Regenerate invite code |

### Trips
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /groups/{group_id}/trips | Yes | Create a trip in a group |
| GET | /groups/{group_id}/trips | Yes | List trips for a group |
| GET | /trips/{trip_id}/public | Optional | Public trip preview |
| PATCH | /trips/{trip_id}/roster | Yes | Set your public trip note |
| POST | /trips/{trip_id}/join-requests | Yes | Request to join this trip’s group |
| GET | /trips/{trip_id}/join-requests | Yes | List pending trip join requests |
| PATCH | /trips/join-requests/{request_id}/approve | Yes | Approve a trip join request |
| PATCH | /trips/join-requests/{request_id}/deny | Yes | Deny a trip join request |
| GET | /trips/{trip_id} | Yes | Get a trip by id |
| PATCH | /trips/{trip_id} | Yes | Update a trip |
| DELETE | /trips/{trip_id} | Yes | Delete a trip |
| PATCH | /trips/{trip_id}/status | Yes | Change trip status |

### Polls
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /trips/{trip_id}/polls | Yes | Create a poll on a trip |
| GET | /trips/{trip_id}/polls | Yes | List polls for a trip |
| GET | /polls/{poll_id} | Yes | Get a poll by id |
| POST | /polls/{poll_id}/vote | Yes | Cast a vote on a poll |
| PATCH | /polls/{poll_id}/close | Yes | Close a poll |
| GET | /polls/{poll_id}/results | Yes | Get poll results |

### Expenses
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /currencies | No | Supported currencies |
| GET | /currencies/rate | Yes | Exchange rate |
| POST | /trips/{trip_id}/expenses | Yes | Add an expense to a trip |
| GET | /trips/{trip_id}/expenses | Yes | List expenses for a trip |
| GET | /trips/{trip_id}/expenses/summary | Yes | Simplified balance summary |
| GET | /trips/{trip_id}/expenses/simplified-debts | Yes | Splitwise-style minimum transfers |
| GET | /trips/{trip_id}/expenses/summary/category | Yes | Expense totals grouped by category |
| GET | /trips/{trip_id}/expenses/export | Yes | Export trip expenses as CSV |
| PATCH | /trips/{trip_id}/expenses/{expense_id} | Yes | Update an expense |
| PATCH | /trips/{trip_id}/expenses/splits/{split_id}/settle | Yes | Mark an expense split as settled |
| DELETE | /trips/{trip_id}/expenses/{expense_id} | Yes | Delete an expense |

### Locations
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /locations | Yes | Save a new location |
| GET | /locations | Yes | List your saved locations |
| GET | /locations/{location_id} | Yes | Get a saved location by id |
| PATCH | /locations/{location_id} | Yes | Update a saved location |
| DELETE | /locations/{location_id} | Yes | Delete a saved location |
| POST | /trips/{trip_id}/locations | Yes | Add a saved location to a trip |
| GET | /trips/{trip_id}/locations | Yes | List locations on a trip |
| DELETE | /trips/{trip_id}/locations/{location_id} | Yes | Remove a location from a trip |

### Notifications
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /notifications | Yes | List your notifications (paginated) |
| GET | /notifications/unread-count | Yes | Count of unread notifications |
| POST | /notifications/read-all | Yes | Mark all notifications as read |
| POST/PATCH | /notifications/{notification_id}/read | Yes | Mark one notification as read |

### Explorer (New)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /explorer/live-feed | No | Get the live destination feed |

### Feed
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /feed/trending | Yes | Trending destinations |
| GET | /feed/search | Yes | Search destinations |
| GET | /feed/destinations/{destination_id} | Yes | Destination detail |

### Invitations
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /invitations/group/{group_id}/invite | Yes | Invite a user to a group |
| POST | /invitations/{invitation_id}/accept | Yes | Accept a group invitation |
| POST | /invitations/{invitation_id}/decline | Yes | Decline a group invitation |
| GET | /invitations/pending | Yes | List pending invitations for current user |
| GET | /invitations/group/{group_id}/pending | Yes (Admin) | List pending invitations for a group |

### Join Requests
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| PATCH | /groups/{group_id}/toggle-membership | Yes (Admin) | Toggle membership accepting |
| POST | /groups/join | Yes | Request to join a group |
| GET | /groups/{group_id}/join-requests | Yes (Admin) | List pending join requests |
| PATCH | /groups/join-requests/{request_id}/approve | Yes (Admin) | Approve join request |
| PATCH | /groups/join-requests/{request_id}/deny | Yes (Admin) | Deny join request |

### Social
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /users/search | Yes | Search users |
| GET | /users/{user_id} | Yes | User profile |
| POST | /social/friend-requests | Yes | Send a connection request |
| GET | /social/friend-requests | Yes | Pending connection requests received |
| GET | /social/friend-requests/sent | Yes | Pending connection requests sent |
| DELETE | /social/friend-requests/{request_id} | Yes | Cancel a pending request |
| PATCH | /social/friend-requests/{request_id}/accept | Yes | Accept a connection request |
| PATCH | /social/friend-requests/{request_id}/decline | Yes | Decline a connection request |
| POST | /social/block | Yes | Block a user |
| DELETE | /social/block/{user_id} | Yes | Unblock a user |
| GET | /social/blocked | Yes | Users you have blocked |
| GET | /social/connections | Yes | Accepted connections |

### Pins
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /pins | Yes | Create a saved pin |
| GET | /pins | Yes | List your saved pins |
| DELETE | /pins/{pin_id} | Yes | Delete a saved pin |
| PATCH | /pins/{pin_id} | Yes | Update a saved pin |

### Subscriptions
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /subscriptions/me | Yes | Current subscription plan |
| POST | /subscriptions/upgrade | Yes | Upgrade subscription plan |
| POST | /subscriptions/cancel | Yes | Cancel subscription |

### Weather
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /weather/forecast | Yes | Weather for coordinates and date |

### Users
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /users/{other_user_id}/balance | Yes | Net expense balance with another user |

### Timers
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /trips/{trip_id}/timer | Yes | Start a trip timer |
| GET | /trips/{trip_id}/timer | Yes | Get current trip timer state |
| DELETE | /trips/{trip_id}/timer | Yes | Cancel trip timer |

### Stats
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /users/me/travel-stats | Yes | Current user travel statistics |

### Location Sharing
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /trips/{trip_id}/location/start | Yes | Start sharing live location |
| PUT | /trips/{trip_id}/location/update | Yes | Update shared coordinates |
| POST | /trips/{trip_id}/location/stop | Yes | Stop sharing live location |
| GET | /trips/{trip_id}/location/members | Yes | List members actively sharing |

### Connect
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /connect/bootstrap | Yes | Bootstrap Connect data |

### Settings
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /settings/app | Yes | Merged app preferences and counts |
| PATCH | /settings/app | Yes | Deep-merge partial preferences |

### AI Assistant
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /ai/assistant | Yes | Sidecar page assistant |

## 2. Frontend API Calls (Sampled)

| File | Endpoint | Method | Params |
|------|----------|--------|--------|
| `verification.ts` | `/auth/send-verification-email` | POST | - |
| `app-settings.ts` | `/settings/app` | GET | - |
| `app-settings.ts` | `/settings/app` | PATCH | preferences |
| `dashboard-user-context.tsx` | `/auth/me` | GET | - |
| `PresenceHeartbeat.tsx` | `/auth/presence` | POST | - |
| `MapComponent.tsx` | `/pins` | GET | - |
| `MapComponent.tsx` | `/pins` | POST | lat, lng, name, flag_type, note |
| `MapComponent.tsx` | `/pins/${id}` | DELETE | - |
| `MapComponent.tsx` | `/pins/${id}` | PATCH | note, flag_type |
| `QuickStatus.tsx` | `/live/trips/${tripId}/quick-status` | POST | status |
| `GroupsSplitLayout.tsx` | `/groups` | GET | - |
| `ExplorerFeedView.tsx` | `/explorer/live-feed` | GET | lat, lon, radius |
| `ExplorerMediaFeed.tsx` | `/explore` | GET | city, tag |
| `WayraPanel.tsx` | `/ai/assistant` | POST | message |
| `ExplorerItemDetailDrawer.tsx` | `/explorer/items/${id}/save` | POST | - |
| `ExplorerItemDetailDrawer.tsx` | `/explorer/items/${id}/vote` | POST | - |
| `AIAssistantSidecar.tsx` | `/ai/assistant` | POST | message |
| `page.tsx` (onboarding) | `/auth/phone/send` | POST | phone |
| `page.tsx` (onboarding) | `/auth/phone/verify` | POST | code |

## 3. Cross-Reference Table

| Status | Backend Endpoint | Frontend Caller | Notes |
|--------|------------------|-----------------|-------|
| ✅ CONNECTED | `POST /auth/presence` | `PresenceHeartbeat.tsx` | Working as expected. |
| ✅ CONNECTED | `GET /settings/app` | `app-settings.ts` | Working as expected. |
| ✅ CONNECTED | `GET /pins` | `MapComponent.tsx` | Working as expected. |
| ✅ CONNECTED | `POST /pins` | `MapComponent.tsx` | Working as expected. |
| ✅ CONNECTED | `DELETE /pins/${id}` | `MapComponent.tsx` | Working as expected. |
| ✅ CONNECTED | `PATCH /pins/${id}` | `MapComponent.tsx` | Working as expected. |
| ✅ CONNECTED | `POST /live/trips/${tripId}/quick-status` | `QuickStatus.tsx` | Working as expected. |
| ✅ CONNECTED | `GET /groups` | `GroupsSplitLayout.tsx` | Working as expected. |
| ✅ CONNECTED | `GET /explorer/live-feed` | `ExplorerFeedView.tsx` | Working as expected. |
| ✅ CONNECTED | `GET /explore` | `ExplorerMediaFeed.tsx` | Working as expected. |
| ✅ CONNECTED | `POST /ai/assistant` | `WayraPanel.tsx`, `AIAssistantSidecar.tsx` | Working as expected. |
| ❌ BROKEN | `/explorer/items/${id}/save` | `ExplorerItemDetailDrawer.tsx` | Endpoint does not exist in backend. |
| ❌ BROKEN | `/explorer/items/${id}/vote` | `ExplorerItemDetailDrawer.tsx` | Endpoint does not exist in backend. |
| ⚠️ UNUSED | `GET /currencies` | None found in sample | Might be used in a file not scanned. |
| ⚠️ UNUSED | `GET /currencies/rate` | None found in sample | Might be used in a file not scanned. |
| ⚠️ UNUSED | `GET /users/me/travel-stats` | None found in sample | Might be used in a file not scanned. |
| ⚠️ UNUSED | `POST /subscriptions/upgrade` | None found in sample | Stub feature. |
| ⚠️ UNUSED | `POST /subscriptions/cancel` | None found in sample | Stub feature. |

*Note: This is a living document and represents a scan of major files. Some connections may need further verification as features are developed.*
