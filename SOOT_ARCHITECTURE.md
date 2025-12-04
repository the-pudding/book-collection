# SOOT WebComponents - Architecture & Data Flow

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Your Browser                          │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌─────────────────────────────────────────────────┐    │
│  │       Index.svelte (Enhanced Component)          │    │
│  ├─────────────────────────────────────────────────┤    │
│  │                                                   │    │
│  │  ┌──────────────────┐  ┌─────────────────────┐  │    │
│  │  │   Sidebar        │  │   Main Content      │  │    │
│  │  │   (Categories)   │  │   (SOOT Embed)      │  │    │
│  │  │                  │  │                     │  │    │
│  │  │ • Category List  │  │ • 3D Canvas         │  │    │
│  │  │ • Search         │  │ • Images/Items      │  │    │
│  │  │ • Icons          │  │ • Focus View        │  │    │
│  │  │ • Active State   │  │                     │  │    │
│  │  └──────────────────┘  └─────────────────────┘  │    │
│  │         │                      △                 │    │
│  │         └──────────┬───────────┘                │    │
│  │                    │                             │    │
│  │  ┌─────────────────────────────────────────┐   │    │
│  │  │    State Management                      │   │    │
│  │  ├─────────────────────────────────────────┤   │    │
│  │  │ • views: View[]                         │   │    │
│  │  │ • activeViewId: string | null           │   │    │
│  │  │ • currentLayout: Layout                 │   │    │
│  │  │ • isLoading: boolean                    │   │    │
│  │  │ • error: string | null                  │   │    │
│  │  └─────────────────────────────────────────┘   │    │
│  │         △                   △                   │    │
│  │         │                   │                   │    │
│  │         └───┬───────────────┘                  │    │
│  │             │                                   │    │
│  │  ┌─────────────────────────────────────────┐   │    │
│  │  │    Event Listeners                      │   │    │
│  │  ├─────────────────────────────────────────┤   │    │
│  │  │ • onMount()                             │   │    │
│  │  │ • addEventListener('loadComplete')      │   │    │
│  │  │ • addEventListener('changeLayout')      │   │    │
│  │  └─────────────────────────────────────────┘   │    │
│  │             △    △    △    △                   │    │
│  └─────────────┼────┼────┼────┼───────────────────┘    │
│                │    │    │    │                        │
└────────────────┼────┼────┼────┼────────────────────────┘
                 │    │    │    │
                 │    │    │    │ (Web Component API)
                 ▼    ▼    ▼    ▼
┌─────────────────────────────────────────────────────────┐
│         <soot-publication> Web Component                 │
│         (Vue Component under the hood)                   │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────────────┐  ┌──────────────────────────────┐ │
│  │ Data Provider    │  │ 3D Rendering                 │ │
│  │ (GraphQL/Apollo) │  │ (Three.js)                   │ │
│  │                  │  │                              │ │
│  │ • getViews()     │  │ • Canvas                     │ │
│  │ • getInstance()  │  │ • Mesh objects               │ │
│  │ • Search         │  │ • Camera control             │ │
│  │ • Filter tags    │  │ • Interactive 3D space       │ │
│  └──────────────────┘  └──────────────────────────────┘ │
│       │                         │                        │
└───────┼─────────────────────────┼────────────────────────┘
        │                         │
        │ GraphQL Queries         │ WebGL Rendering
        ▼                         ▼
┌─────────────────────────────────────────────────────────┐
│          SOOT Backend (play.soot.com)                    │
│                                                           │
│  • Space Management                                       │
│  • Image Storage & Processing                           │
│  • Metadata Management                                   │
│  • View Configuration                                    │
│  • Search & Filter Execution                            │
└─────────────────────────────────────────────────────────┘
```

## Data Flow Diagram

### 1. Initial Load Flow

```
onMount() triggered
    │
    ├─> import("soot-webcomponents")
    │
    ├─> <soot-publication> mounts
    │
    ├─> SOOT loads space (slug: "...")
    │
    ├─> SOOT emits loadComplete event
    │
    ├─> Event listener catches loadComplete
    │
    ├─> Call: expose.getViews()
    │
    ├─> Backend returns: View[]
    │   ┌─ id: "abc123"
    │   ├─ displayName: "Paintings"
    │   ├─ icon: "https://..."
    │   └─ [more views...]
    │
    ├─> Update: views = View[]
    │
    ├─> Update: isLoading = false
    │
    ├─> Render categories in sidebar
    │
    └─> Ready for user interaction
```

### 2. Category Switch Flow

```
User clicks category button
    │
    ├─> onClick handler fires
    │
    ├─> Call: switchToView(viewId)
    │
    ├─> Call: sootElement.expose.setActiveView(viewId)
    │
    ├─> SOOT updates internal state
    │
    ├─> SOOT re-renders 3D scene
    │
    ├─> SOOT emits changeLayout event
    │
    ├─> Event listener catches changeLayout
    │
    ├─> Extract: layout = event.detail.eventData.layout
    │
    ├─> Check: layout.type === 'SAVED_VIEW'
    │
    ├─> Update: activeViewId = layout.viewId
    │
    ├─> Svelte reactivity:
    │   ├─> Sidebar updates: category button gets .active class
    │   ├─> Header updates: shows new view name
    │   └─> Console logs: "🎯 Switching to..."
    │
    └─> UI updated
```

### 3. Search Flow

```
User performs search (or clicks tag)
    │
    ├─> SOOT captures user action
    │
    ├─> SOOT builds SearchQuery
    │   ├─ type: "TEXT" | "FILTER_TO_TAG" | ...
    │   └─ query details
    │
    ├─> SOOT emits changeLayout event
    │
    ├─> Event listener catches changeLayout
    │
    ├─> Extract: layout.type === 'SEARCH'
    │
    ├─> Update: activeViewId = null (not a saved view)
    │
    ├─> Extract search details:
    │   ├─ layout.query.type
    │   ├─ layout.query.text (if TEXT)
    │   ├─ layout.query.tagId (if FILTER_TO_TAG)
    │   └─ etc.
    │
    ├─> Sidebar updates: no category highlighted
    │
    ├─> Header updates: "Search Result"
    │
    └─> Console logs: search details
```

## State Relationships

```
┌──────────────────────────────────────────────────────┐
│               Global Component State                  │
├──────────────────────────────────────────────────────┤
│                                                       │
│  views[]                                              │
│  ├─ All categories from SOOT                         │
│  ├─ Populated on loadComplete                        │
│  └─ Used to render category list                     │
│                                                       │
│  activeViewId (string | null)                         │
│  ├─ null when in search mode                         │
│  ├─ Set when layout.type === 'SAVED_VIEW'           │
│  └─ Used for highlighting active category            │
│                                                       │
│  currentLayout (Layout)                               │
│  ├─ Full layout object from SOOT                     │
│  ├─ Updated on changeLayout event                    │
│  ├─ Type: SavedViewLayout | SearchLayout             │
│  └─ Contains all layout details                       │
│                                                       │
│  isLoading (boolean)                                  │
│  ├─ true initially                                   │
│  ├─ false after categories load                      │
│  └─ Used for loading state UI                        │
│                                                       │
│  error (string | null)                               │
│  ├─ null by default                                  │
│  ├─ Set if getViews() fails                          │
│  └─ Used for error state UI                          │
│                                                       │
└──────────────────────────────────────────────────────┘
```

## Component Lifecycle

```
Mount Phase
───────────
1. Component mounts
2. onMount() runs
3. soot-publication imports
4. <soot-publication> renders
5. SOOT initializes
6. SOOT loads space

Ready Phase (loadComplete)
──────────────────────────
1. loadComplete event fires
2. getViews() called
3. categories = View[]
4. isLoading = false
5. Sidebar rendered with categories

Interactive Phase (changeLayout)
─────────────────────────────────
1. User interacts
2. changeLayout event fires
3. Update activeViewId or search state
4. UI reactively updates
5. Log event details
6. Repeat...
```

## View Type Hierarchy

```
Layout
├── SavedViewLayout
│   ├── id: string
│   ├── displayName: string
│   ├── icon: string | null
│   └── [configured in SOOT backend]
│
└── SearchLayout
    ├── TEXT
    │   └── Similarity-based search
    ├── FILTER_TO_TAG
    │   ├── propertyId: string
    │   └── tagId: string
    ├── SEE_SIMILAR
    │   ├── instanceId: string
    │   └── objectVersionId: string
    └── METADATA_QUERY
        └── query: {...}
```

## Event Sequence Diagram

```
Time ──────────────────────────────────────────────────>

User          Component           SOOT              Backend
 │                │                 │                  │
 │                │  Page Load      │                  │
 │                ├────────────────>│                  │
 │                │                 │  Fetch Space    │
 │                │                 ├─────────────────>
 │                │                 │                  │
 │                │                 │<─ Space Config ─┤
 │                │                 │                  │
 │                │ loadComplete    │                  │
 │                │<────────────────┤                  │
 │                │                 │                  │
 │                │ getViews()      │                  │
 │                ├────────────────>│                  │
 │                │                 │  GraphQL Query   │
 │                │                 ├─────────────────>
 │                │                 │                  │
 │                │                 │<─ View List ───┤
 │                │<────────────────┤                  │
 │                │ Render Category List              │
 │                │ [Ready]         │                  │
 │                │                 │                  │
 │                │ [Sidebar rendered]                │
 │                │                 │                  │
 │ Click Category │                 │                  │
 ├───────────────>│                 │                  │
 │                │ setActiveView() │                  │
 │                ├────────────────>│                  │
 │                │                 │ Change Layout   │
 │                │                 │ [re-render]     │
 │                │ changeLayout    │                  │
 │                │<────────────────┤                  │
 │                │ Update State    │                  │
 │                │ Update UI       │                  │
 │ [See Changes]  │                 │                  │
 │<───────────────┤                 │                  │
 │                │                 │                  │
```

## Communication Protocols

### Client → SOOT
```
Method Calls:
├── expose.getViews()
├── expose.setActiveView(id)
├── expose.executeSearch(query)
├── expose.selectInstance(id)
├── expose.deselectInstance()
├── expose.getInstanceDetails(id)
└── expose.getAutocompletions(query)

Attributes:
├── slug: "..."
├── loadonmount: true
├── introstartz: 3
├── introendz: 20
└── ...
```

### SOOT → Client
```
Events:
├── loadComplete
│   └── layout: SavedViewLayout | SearchLayout
│
├── changeLayout
│   ├── layout: SavedViewLayout | SearchLayout
│   └── triggerType: "INTERNAL" | "EXTERNAL"
│
├── selectInstance
│   ├── instanceId: string
│   └── triggerType: "INTERNAL" | "EXTERNAL"
│
└── deselectInstance
    └── triggerType: "INTERNAL" | "EXTERNAL"
```

## Performance Characteristics

```
Operation                Time          Notes
─────────────────────────────────────────────
Load Component           < 100ms       Import dynamic module
Initialize SOOT          1-3s          Varies by network
Load Space               2-5s          Depends on space size
Fetch Categories         < 500ms       GraphQL query
Switch Category          < 200ms       State update + re-render
Search Query             1-5s          Depends on result count
Get Instance Details     < 500ms       Single item fetch
```

## Browser Rendering Pipeline

```
Event fires
    │
    ├─> JavaScript execution
    │   ├─> Update state
    │   └─> Trigger reactivity
    │
    ├─> Svelte compilation
    │   ├─> Detect changes
    │   └─> Update DOM
    │
    ├─> Browser reflow
    │   ├─> Recalculate layout
    │   └─> Update styles
    │
    ├─> GPU acceleration
    │   ├─> Composite layers
    │   └─> Render to screen
    │
    └─> Frame complete (60 FPS target)
```

---

## Quick Reference by Component

### Sidebar Component
- **Purpose**: Display and navigate categories
- **State**: `views`, `activeViewId`
- **Actions**: `switchToView(id)`
- **Events**: Listen for `changeLayout`

### Main Content Area
- **Purpose**: Host SOOT publication
- **Props**: `slug`, `introstartz`, `introendz`
- **Responsive**: Flex-based layout
- **Events**: All SOOT events

### State Layer
- **Purpose**: Centralize app state
- **Variables**: `views`, `activeViewId`, `currentLayout`, `isLoading`, `error`
- **Lifecycle**: Populated on load, updated on interaction

---

This architecture enables flexible, scalable category management while maintaining clean separation of concerns!


