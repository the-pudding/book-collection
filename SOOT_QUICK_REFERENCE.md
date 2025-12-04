# SOOT WebComponents - Quick Reference

## Essential API Methods

```javascript
// Get all available categories
const views = await sootElement.expose.getViews();
// Returns: Array<{ id: string, displayName: string, icon: string|null }>

// Switch to a category
sootElement.expose.setActiveView(viewId);

// Perform a search
await sootElement.expose.executeSearch(queryText);

// Get item details
const details = await sootElement.expose.getInstanceDetails(instanceId);

// Select/deselect items
sootElement.expose.selectInstance(instanceId);
sootElement.expose.deselectInstance();

// Get search autocomplete suggestions
const suggestions = sootElement.expose.getAutocompletions(queryText);
```

## Essential Events

```javascript
// When space loads
sootElement.addEventListener('loadComplete', (e) => {
  const layout = e.detail.eventData.layout;
});

// When user switches view
sootElement.addEventListener('changeLayout', (e) => {
  const { layout, triggerType } = e.detail.eventData;
  // layout.type: 'SAVED_VIEW' | 'SEARCH'
  // layout.viewId (if SAVED_VIEW)
  // layout.query (if SEARCH)
});

// When user selects an item
sootElement.addEventListener('selectInstance', (e) => {
  const instanceId = e.detail.eventData.instanceId;
});

// When user closes item view
sootElement.addEventListener('deselectInstance', (e) => {
  // User closed focus view
});
```

## Category/View Structure

```typescript
// Your categories
type View = {
  id: string;           // UUID, e.g. "abc-123-def"
  displayName: string;  // e.g. "Paintings"
  icon: string | null;  // URL to SVG/image, or null
};

// Active layout
type Layout = SavedViewLayout | SearchLayout;

type SavedViewLayout = {
  type: "SAVED_VIEW";
  viewId: string;        // Matches a View.id
  focusOnInstanceId?: string;
};

type SearchLayout = {
  type: "SEARCH";
  query: SearchQuery;
};
```

## Common Patterns

### Initialize and Get Categories
```javascript
onMount(async () => {
  await import("soot-webcomponents");
  
  sootElement.addEventListener('loadComplete', async () => {
    const views = await sootElement.expose.getViews();
    // Now you have all categories
  });
});
```

### Track Active Category
```javascript
sootElement.addEventListener('changeLayout', (e) => {
  const layout = e.detail.eventData.layout;
  
  if (layout.type === 'SAVED_VIEW') {
    activeViewId = layout.viewId;
    const name = views.find(v => v.id === activeViewId)?.displayName;
    console.log('Active:', name);
  }
});
```

### Build Category Navigation
```javascript
{#each views as view}
  <button 
    on:click={() => sootElement.expose.setActiveView(view.id)}
    class:active={activeViewId === view.id}
  >
    {#if view.icon}
      <img src={view.icon} alt="" />
    {/if}
    {view.displayName}
  </button>
{/each}
```

## Category Types

| Type | Origin | Trigger |
|------|--------|---------|
| SAVED_VIEW | Configured in SOOT space | User clicks category or programmatic `setActiveView()` |
| SEARCH (TEXT) | User input | User types in search bar or `executeSearch()` |
| SEARCH (FILTER_TO_TAG) | Metadata filtering | User clicks tag or programmatic filter |
| SEARCH (SEE_SIMILAR) | Visual search | User clicks "similar" button |
| SEARCH (METADATA_QUERY) | Advanced search | User creates saved search |

## State Management

```javascript
// Keep track of current state
let views = [];           // All categories
let activeViewId = null;  // Current view ID (null if searching)
let currentLayout = null; // Full layout object
let isLoading = false;    // Loading state
```

## Property Configuration

```svelte
<soot-publication
  slug="space-id"           <!-- Required: Your space slug -->
  loadonmount={true}        <!-- Load on mount (default: true) -->
  introstartz={3}           <!-- Initial camera zoom out -->
  introendz={20}            <!-- Final camera zoom out -->
  introdurationms={1500}    <!-- Animation duration (ms) -->
  maxzvaluemultiplier={1}   <!-- Adjust max scroll distance -->
/>
```

## CSS Variables

```css
soot-publication {
  --soot-sans-serif-font-family: Arial, sans-serif;
  --soot-default-text-color: #333;
  --soot-light-text-color: #666;
  --soot-highlighted-background: #e3f2fd;
  --soot-secondary-button-background: #f5f5f5;
  --soot-pill-background: #e0e0e0;
  --soot-pill-label-background: #999;
}
```

## Debugging Tips

```javascript
// See all views in console
console.table(views);

// Check current layout
console.log(JSON.stringify(currentLayout, null, 2));

// Check if view exists
console.log('View exists?', views.some(v => v.id === targetId));

// Get view name by ID
const getName = (id) => views.find(v => v.id === id)?.displayName;
console.log('Active view:', getName(activeViewId));

// Check trigger source
console.log(e.detail.eventData.triggerType); // 'INTERNAL' or 'EXTERNAL'
```

## Common Issues

| Issue | Solution |
|-------|----------|
| Views not loading | Make sure `loadComplete` event fires before calling `getViews()` |
| View won't switch | Verify view ID is in the `views` array |
| Events not firing | Ensure listeners attached in `onMount()` hook |
| Layout not updating | Check `changeLayout` event listener is attached |
| Icons not showing | Verify `view.icon` is a valid URL or null |

## Full Example

```svelte
<script>
  import { onMount } from 'svelte';
  
  let sootElement;
  let views = [];
  let activeViewId = null;
  
  onMount(async () => {
    await import('soot-webcomponents');
    
    sootElement.addEventListener('loadComplete', async (e) => {
      views = await sootElement.expose.getViews();
      console.log(`Loaded ${views.length} categories`);
    });
    
    sootElement.addEventListener('changeLayout', (e) => {
      const layout = e.detail.eventData.layout;
      if (layout.type === 'SAVED_VIEW') {
        activeViewId = layout.viewId;
      }
    });
  });
  
  const switchCategory = (id) => {
    sootElement.expose.setActiveView(id);
  };
</script>

<div>
  {#each views as view}
    <button 
      on:click={() => switchCategory(view.id)}
      class:active={activeViewId === view.id}
    >
      {view.displayName}
    </button>
  {/each}
</div>

<soot-publication bind:this={sootElement} slug="your-space-id" />
```

---

**Need more?** Check `SOOT_CATEGORIES_GUIDE.md` for detailed documentation.


