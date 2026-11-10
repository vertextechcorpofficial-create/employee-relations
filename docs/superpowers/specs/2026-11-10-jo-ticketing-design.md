# JO / Ticketing Module Design & Architecture Plan

## 1. Goal

Implement a **Job Order (JO) / Service Ticketing** module inside the **Employee Relations (ER)** subsystem (`employee-relations` repository) enabling requesters to register service categories and submit purely digital job order requests with attached pictures and supporting documents, while allowing decoupled request receivers (e.g., Customer Relations) to track the list of JOs and update statuses directly without an acknowledgement gate.

---

## 2. Functional Requirements Breakdown

### A. Requester POV (Employee Relations Repo)
- **Registration of Categories of Services**:
  - Maintain a registry of service categories (create, edit, activate/deactivate).
  - Select from registered categories when submitting a new Job Order.
- **Digital-Only Record**:
  - Strictly digital records stored in the database (`no physical/printable document templates` or PDF form downloads required for the JO itself).
- **Multi-Type Attachments**:
  - Support uploading **Pictures** (`.png`, `.jpg`, `.jpeg`, `.webp`, client-side compressed via `browser-image-compression`).
  - Support uploading **Supporting Documents** (`.pdf`, `.doc`, `.docx`, `.xls`, `.xlsx`, etc.).
  - Files stored via Directus `/files` API inside a dedicated folder (`job_order`).
- **Remarks & Submission**:
  - Required `remarks` field capturing the request details/instructions.
  - Submit creates the JO digital record with an initial status (`Open` / `Pending`).
- **Requester Tracking**:
  - View a list of submitted JOs, inspect details/attachments, and monitor live status updates.

### B. Request Receiver POV (Customer Relations / Handling Side)
- **No Acknowledge Step**:
  - There is **no** intermediate "Acknowledge" button, phase, or status.
  - Submitted JOs enter directly into the active queue (`Open`) so receivers can immediately process them.
- **List of JO & Status Management**:
  - View incoming Job Orders with category, remarks, pictures, and supporting documents.
  - Transition JO status directly (e.g., `Open` → `In Progress` → `Resolved` / `Cancelled`).
- **Decoupled Identity**:
  - `user_id` stored without foreign key constraints; `username` stored as a plain/hardcoded text string so receiver and requester interfaces can operate independently across subsystems/repos.

---

## 3. Existing Directus Discovery (`http://goatedcodoer:8056`)

Inspection of the Directus instance shows three pre-existing collections:

| Collection | Existing Fields | Notes |
|---|---|---|
| `ticket` | `ticket_id`, `ticket_number`, `title`, `description`, `category_id`, `status`, `priority`, `created_by`, `assigned_to`, `reporter_name`, `reporter_description`, `images` (`json`), `created_at`, `updated_at`, `follow_up_timestamp` | Contains 5 test records from Aug 2026 (`TKT-743474` to `TKT-752709`). |
| `ticket_category` | `category_id`, `category_name`, `description`, `is_active` | Contains 4 records: `VOS`, `IDS`, `LGU`, `ITCS`. |
| `ticket_activity` | `activity_id`, `ticket_id`, `user_id`, `activity_type`, `old_status`, `new_status`, `note`, `created_at` | Status audit log. |

---

## 4. Database Contract (Decoupled User Design)

> [!IMPORTANT]
> **No Foreign Keys on Users**: Per specification, `user_id` columns MUST be plain integers/strings with **NO foreign key constraint** (`M2O` relation) to `user` or `directus_users`. `username` MUST be stored directly as a plain `varchar` column (hardcoded or captured directly without table joins).

### Finalized Schema (`iot_jo_*` Directus Collections Created)

#### 1. `iot_jo_service_category`
| Field | Type | Constraints / Notes |
|---|---|---|
| `id` | `integer` | Primary Key, Auto-increment |
| `category_name` | `varchar(150)` | Required, unique service category label |
| `description` | `text` | Optional description of the service category |
| `is_active` | `boolean` | Default `true` (`1`) |
| `created_by_user_id` | `integer` | **NO FK** |
| `created_by_username` | `varchar(100)` | Plain text / hardcoded fallback (`"ER_REQUESTER"`) |
| `created_at` | `datetime` | Timestamp of creation |

#### 2. `iot_jo_request`
| Field | Type | Constraints / Notes |
|---|---|---|
| `id` | `integer` | Primary Key, Auto-increment |
| `jo_number` | `varchar(50)` | Auto-generated reference (e.g., `JO-20261110-1234`) |
| `category_id` | `integer` | References `iot_jo_service_category.id` |
| `remarks` | `text` | Required request description / remarks |
| `status` | `varchar(30)` | `'Open' \| 'In Progress' \| 'Resolved' \| 'Cancelled'` *(No `Acknowledged` state)* |
| `requester_user_id` | `integer` | **NO FK** |
| `requester_username` | `varchar(100)` | Plain text / hardcoded fallback (`"ER_REQUESTER"`) |
| `receiver_user_id` | `integer` | Nullable, **NO FK** |
| `receiver_username` | `varchar(100)` | Nullable, plain text / hardcoded fallback (`"CR_RECEIVER"`) |
| `created_at` | `datetime` | Timestamp |
| `updated_at` | `datetime` | Timestamp |

#### 3. `iot_jo_attachment` *(Supports Pictures + Supporting Documents)*
| Field | Type | Constraints / Notes |
|---|---|---|
| `id` | `integer` | Primary Key, Auto-increment |
| `jo_id` | `integer` | References `iot_jo_request.id` |
| `directus_file_id` | `uuid` | Directus file ID from `/files` (stored in folder `job_order`) |
| `file_name` | `varchar(255)` | Original filename |
| `file_type` | `varchar(100)` | MIME type (e.g., `image/jpeg`, `application/pdf`) |
| `attachment_kind` | `varchar(20)` | `'PICTURE' \| 'DOCUMENT'` |
| `uploaded_at` | `datetime` | Timestamp |

---

## 5. Module Architecture Plan (Following `AGENTS.md` Rules)

Per **Strict Rule 4 (Module Structure)** and **Strict Rule 5 (Protected Files)**, all module logic is strictly isolated inside `src/modules/er/job-order/`, `src/app/api/er/job-order/`, and `src/app/(employee-relations)/er/job-order/`.

### Directory Blueprint

```text
src/modules/er/job-order/
├── types/
│   └── job-order.schema.ts           # Layer 0: Zod schemas & TS contracts (JO, Category, Attachment)
├── services/                         # Layer 1: Pure TS Directus API services (NO React hooks)
│   ├── job-order-query.ts            # Fetch JOs, categories, and attachments (<300 lines)
│   ├── job-order-actions.ts          # Create JO, register category, update status (<300 lines)
│   └── index.ts                      # Barrel re-export
├── hooks/                            # Layer 3: React state & query bridges (<150 lines each)
│   ├── useJobOrders.ts               # JO list, submit, status updates
│   └── useServiceCategories.ts       # Service category registration & fetching
├── components/                       # Layer 4: Pure UI presentation (Zero direct fetches)
│   ├── data-table/
│   │   ├── JobOrderTable.tsx         # JO list with status badges & attachment indicators
│   │   └── CategoryTable.tsx         # Registered service categories grid
│   ├── forms/
│   │   ├── CreateJobOrderDialog.tsx  # Category select, Remarks, Picture & Doc upload, Submit
│   │   └── CategoryFormDialog.tsx    # Register / edit Categories of Services
│   └── modals/
│       └── JobOrderDetailsModal.tsx  # Digital record viewer, image gallery, doc download, status change
└── JobOrderModule.tsx                # Client shell orchestrating tabs & dialogs
```

### API Gateway Routes (`src/app/api/er/job-order/`)

| Route | Methods | Responsibility |
|---|---|---|
| `route.ts` | `GET`, `POST` | List Job Orders (filter by status/requester) & create new digital JO (Zod validated) |
| `[id]/route.ts` | `GET`, `PATCH` | Retrieve single JO with attachments & update status directly |
| `categories/route.ts` | `GET`, `POST`, `PATCH` | Fetch and register/update Categories of Services |
| `upload/route.ts` | `POST` | Upload Pictures & Supporting Documents to Directus `/files` |
| `file/route.ts` | `GET` | Secure proxy endpoint to preview images and download supporting documents |

### Route Page (`src/app/(employee-relations)/er/job-order/page.tsx`)
- Server component shell rendering `<SidebarTrigger>`, `<Breadcrumb>`, `<NavUser>`, and scrolling `<main>` containing `<JobOrderModule />`.

---

## 6. Theme & UI Compliance (Following Strict Rule 3)

- **Semantic Color Tokens Only**: `bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-primary`. Zero hardcoded hex colors.
- **Dual-Theme Support**: Tested and legible in both Light Mode and Dark Mode.
- **Shadcn UI Primitives**: Exclusively built with `@/components/ui/` (`Dialog`, `Table`, `Badge`, `Button`, `Input`, `Textarea`, `Select`, `Tabs`, `Card`).
- **Standard States**:
  - Loading: `<DataTableSkeleton>`
  - Empty: `<EmptyPlaceholder>`
  - Errors: `<ErrorPage>` + `sonner` toast feedback.

---

## 7. Confirmed Design Decisions

1. **Database Tables**: Created dedicated `iot_jo_service_category`, `iot_jo_request`, and `iot_jo_attachment` collections in Directus with zero foreign keys on `user_id` columns.
2. **Request Receiver View Location**: Included both **My Job Orders (Requester POV)** and **Receiver Queue (List of JO)** tabs inside `/er/job-order` so end-to-end status updates (without an acknowledgement gate) can be tested directly.
3. **Decoupled Identity Behavior**: Captures active session `userId` and `username` into plain fields when authenticated, falling back to hardcoded constants (`"ER_REQUESTER"` / `"CR_RECEIVER"`) when auth is bypassed.
4. **Category Registration Placement**: Mounted as the **"Categories of Services"** tab inside `/er/job-order`.

