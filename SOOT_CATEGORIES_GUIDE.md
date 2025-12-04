# SOOT WebComponents - Category View Management Guide

## Overview

This guide explains how the SOOT WebComponents library determines and displays categories/views, and documents the enhancements made to your `Index.svelte` component.

## How Category Views Are Determined

### 1. **View Types**

SOOT supports two types of layouts:

#### **SAVED_VIEW** (Static Categories)
- Pre-configured in your SOOT space (play.soot.com)
- Managed through the space sharing panel
- Each view has:
  - `id`: Unique identifier
  - `displayName`: Human-readable name (e.g., "Architecture", "Landscapes")
  - `icon`: Optional custom SVG/image icon (or `null` for default)

#### **SEARCH** (Dynamic Views)
- Generated at runtime based on user interactions
- Multiple query types:
  - **TEXT**: Visual similarity search
  - **FILTER_TO_TAG**: Filter by metadata tag/property
  - **SEE_SIMILAR**: Find similar items to a selected image
  - **METADATA_QUERY**: Advanced search with multiple filters

### 2. **API Flow**

```
User loads page
    ↓
soot-publication loads with slug
    ↓
loadComplete event fires
    ↓
getViews() API called
    ↓
Array of View objects returned
    ↓
Display categories in UI
```

### 3. **Data Structure**

```typescript
// View object returned by getViews()
type View = {
  id: string;           // Unique identifier (UUID format)
  displayName: string;  // Category name to show users
  icon: string | null;  // Optional icon URL
};

// Layout types
type SavedViewLayout = {
  type: "SAVED_VIEW";
  viewId: string;              // Matches a View.id
  focusOnInstanceId?: string;  // Optional instance to focus on
};

type SearchLayout = {
  type: "SEARCH";
  query: SearchQuery;  // See below
};

// Search query types
type SearchQuery = 
  | TextSearchQuery        // { type: "TEXT"; text: string }
  | SeeSimilarSearchQuery  // { type: "SEE_SIMILAR"; instanceId: string }
  | FilterToTagSearchQuery // { type: "FILTER_TO_TAG"; tagId: string; propertyId: string }
  | MetadataSearchQuery;   // { type: "METADATA_QUERY"; query: {...} }
```

## Component Enhancements

Your enhanced `Index.svelte` now includes:

### **1. Category State Management**

```javascript
let views = [];           // Array of all available categories
let activeViewId = null;  // Currently active view ID
let isLoading = true;     // Loading state for categories
let error = null;         // Error state
```

### **2. Category Loading**

On `loadComplete` event:
```javascript
const views = await sootElement.expose.getViews();
console.log(`📚 Found ${views.length} categories/views:`, views);
```

### **3. Active Category Tracking**

When layout changes:
```javascript
if (layout.type === 'SAVED_VIEW') {
  activeViewId = layout.viewId;
  const viewName = views.find(v => v.id === layout.viewId)?.displayName;
  console.log(`Active category: "${viewName}"`);
}
```

### **4. Category Switching**

```javascript
function switchToView(viewId) {
  const viewName = views.find(v => v.id === viewId)?.displayName;
  console.log(`🎯 Switching to view: "${viewName}"`);
  sootElement.expose.setActiveView(viewId);
}
```

## UI Features

### **Sidebar Category List**

- Shows all available categories
- Displays category count
- Active category is highlighted in blue
- Icons displayed if available
- Hover effects for better UX
- Responsive design (collapses on mobile)

### **Current View Display**

- Header shows the currently active category name
- Updates in real-time as user navigates
- Displays "Search Result" when in search mode

### **Visual Indicators**

- ✨ Space loaded
- 📚 Categories found
- 📁 Saved view layout
- 🔍 Search layout
- 🎯 Switching to view
- ❌ Error states

## Console Logging

Enhanced console output for debugging:

```
✨ SOOT space loaded!
📚 Found 5 categories/views:
   1. "All Works" (ID: abc123...)
   2. "Paintings" (ID: def456...)
   3. "Sculptures" (ID: ghi789...)
   4. "Photography" (ID: jkl012...)
   5. "Mixed Media" (ID: mno345...)

🔄 Layout Changed
   Timestamp: 10:45:23 AM
   Trigger Type: INTERNAL
   📁 Layout Type: Saved View
   └─ View ID: def456...
   └─ View Name: "Paintings"
```

## Advanced Usage Examples

### **Get All Categories**

```javascript
const categories = await sootElement.expose.getViews();
const categoryNames = categories.map(c => c.displayName);
console.log('Available categories:', categoryNames);
```

### **Switch to Specific Category**

```javascript
const paintings = views.find(v => v.displayName.includes('Paintings'));
if (paintings) {
  sootElement.expose.setActiveView(paintings.id);
}
```

### **Listen to Category Changes**

```javascript
sootElement.addEventListener('changeLayout', (e) => {
  const layout = e.detail.eventData.layout;
  if (layout.type === 'SAVED_VIEW') {
    const category = views.find(v => v.id === layout.viewId);
    console.log('User switched to:', category.displayName);
  }
});
```

### **Perform Text Search**

```javascript
sootElement.expose.executeSearch('red abstract paintings');
// This triggers a TEXT search query
```

### **Filter by Tag**

```javascript
// Through UI - user clicks a tag in focus view
// Or programmatically through search results

const filteredLayout = {
  type: 'SEARCH',
  query: {
    type: 'FILTER_TO_TAG',
    propertyId: 'property-id',
    tagId: 'tag-id'
  }
};
```

## Configuration

### **SOOT Publication Props**

```svelte
<soot-publication
  slug="30aeca63-79f1-44b1-b7ca-f8c04eaa5f77"  // Your space slug
  introstartz="3"                               // Start zoom level
  introendz="20"                                // End zoom level
  introdurationms="1500"                        // Animation duration
  loadonmount={true}                            // Load on component mount
/>
```

### **CSS Variables for Styling**

```css
soot-publication {
  --soot-sans-serif-font-family: 'Arial', sans-serif;
  --soot-default-text-color: #333;
  --soot-light-text-color: #666;
  --soot-highlighted-background: #e3f2fd;
  --soot-secondary-button-background: #f5f5f5;
  --soot-pill-background: #e0e0e0;
  --soot-pill-label-background: #999;
}
```

## Events

The component fires these events:

### **loadComplete**
```javascript
sootElement.addEventListener('loadComplete', (e) => {
  const layout = e.detail.eventData.layout;
  // Space has loaded and initial layout is set
});
```

### **changeLayout**
```javascript
sootElement.addEventListener('changeLayout', (e) => {
  const { layout, triggerType } = e.detail.eventData;
  // User switched view or performed search
  // triggerType: 'INTERNAL' (user) or 'EXTERNAL' (programmatic)
});
```

### **selectInstance**
```javascript
sootElement.addEventListener('selectInstance', (e) => {
  const instanceId = e.detail.eventData.instanceId;
  // User selected an item
});
```

### **deselectInstance**
```javascript
sootElement.addEventListener('deselectInstance', (e) => {
  // User closed focus view
});
```

## Responsive Design

The component is optimized for:

- **Desktop (>768px)**: Side-by-side layout with sidebar and content
- **Tablet (≤768px)**: Horizontal scrollable categories at top
- **Mobile**: Stacked layout with category carousel

## Troubleshooting

### Categories Not Loading?

Check the browser console:
```javascript
// Should show categories after loadComplete fires
sootElement.addEventListener('loadComplete', async (e) => {
  const views = await sootElement.expose.getViews();
  console.log('Views loaded:', views.length);
});
```

### View Not Switching?

Ensure the view ID is valid:
```javascript
// Get all valid IDs
const validIds = views.map(v => v.id);
console.log('Valid view IDs:', validIds);

// Only switch to valid IDs
if (validIds.includes(selectedId)) {
  sootElement.expose.setActiveView(selectedId);
}
```

### Events Not Firing?

Make sure the event listeners are attached after component mounts:
```javascript
onMount(() => {
  // Listeners must be attached here, not in <script>
  sootElement.addEventListener('changeLayout', ...);
});
```

## Further Customization

You can create custom slots for:

1. **omnibar** - Replace search bar
2. **viewslist** - Replace views selector
3. **focusview** - Replace detail view

Example:
```svelte
<soot-publication bind:this={sootElement} slug="...">
  <div slot="omnibar">
    <!-- Your custom search bar -->
  </div>
  <div slot="viewslist">
    <!-- Your custom category list -->
  </div>
</soot-publication>
```

## Performance Tips

1. **Cache view data**: Store views array to avoid repeated API calls
2. **Debounce search**: Prevent rapid-fire search requests
3. **Lazy load icons**: Only download category icons when visible
4. **Minimize re-renders**: Use Svelte reactivity stores for state

---

For more information, visit:
- [SOOT Website](https://play.soot.com)
- [soot-webcomponents on npm](https://www.npmjs.com/package/soot-webcomponents)


