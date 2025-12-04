# SOOT WebComponents - Advanced Examples & Customization

## 1. Custom Category Selector Component

Create a more advanced category selector with search and filtering:

```svelte
<!-- CategorySelector.svelte -->
<script>
  import { onMount } from 'svelte';
  
  export let views = [];
  export let activeViewId = null;
  export let onSelectView = (id) => {};
  
  let searchQuery = '';
  let filteredViews = [];
  
  $: filteredViews = views.filter(v => 
    v.displayName.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const handleSearch = (e) => {
    searchQuery = e.target.value;
  };
  
  const getIconUrl = (view) => {
    return view.icon || '📁'; // Fallback to emoji
  };
</script>

<div class="category-selector">
  <input 
    type="search" 
    placeholder="Search categories..." 
    on:input={handleSearch}
  />
  
  {#if filteredViews.length === 0}
    <p>No categories found</p>
  {:else}
    <ul>
      {#each filteredViews as view}
        <li>
          <button
            class:active={activeViewId === view.id}
            on:click={() => onSelectView(view.id)}
          >
            {#if typeof getIconUrl(view) === 'string' && getIconUrl(view).startsWith('http')}
              <img src={getIconUrl(view)} alt="" />
            {:else}
              <span>{getIconUrl(view)}</span>
            {/if}
            <span>{view.displayName}</span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .category-selector {
    padding: 1rem;
  }
  
  input {
    width: 100%;
    padding: 0.5rem;
    margin-bottom: 1rem;
    border: 1px solid #ddd;
    border-radius: 4px;
  }
  
  ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  
  button {
    width: 100%;
    padding: 0.75rem;
    text-align: left;
    border: 1px solid #ddd;
    background: white;
    cursor: pointer;
    border-radius: 4px;
    margin-bottom: 0.5rem;
  }
  
  button.active {
    background: #e3f2fd;
    border-color: #1976d2;
  }
</style>
```

## 2. Analytics Integration

Track category changes and user behavior:

```javascript
// Create a category analytics module
export const createCategoryAnalytics = (sootElement) => {
  let eventLog = [];
  
  const logEvent = (eventType, data) => {
    const event = {
      type: eventType,
      timestamp: new Date().toISOString(),
      ...data
    };
    eventLog.push(event);
    console.log('📊 Analytics:', event);
  };
  
  sootElement.addEventListener('loadComplete', (e) => {
    logEvent('space_loaded', {
      initialLayout: e.detail.eventData.layout
    });
  });
  
  sootElement.addEventListener('changeLayout', (e) => {
    const layout = e.detail.eventData.layout;
    if (layout.type === 'SAVED_VIEW') {
      logEvent('view_changed', {
        viewId: layout.viewId,
        trigger: e.detail.eventData.triggerType
      });
    } else {
      logEvent('search_performed', {
        queryType: layout.query.type,
        trigger: e.detail.eventData.triggerType
      });
    }
  });
  
  sootElement.addEventListener('selectInstance', (e) => {
    logEvent('item_selected', {
      instanceId: e.detail.eventData.instanceId
    });
  });
  
  return {
    getLog: () => eventLog,
    clearLog: () => { eventLog = []; },
    exportLog: () => JSON.stringify(eventLog, null, 2)
  };
};

// Usage:
const analytics = createCategoryAnalytics(sootElement);
console.log(analytics.exportLog());
```

## 3. Category State Store (Svelte)

Use a Svelte store for reactive category state:

```javascript
// stores/categoryStore.js
import { writable } from 'svelte/store';

export const views = writable([]);
export const activeViewId = writable(null);
export const currentLayout = writable(null);
export const isLoading = writable(true);
export const error = writable(null);

export const categoryStore = {
  setViews: (newViews) => views.set(newViews),
  setActiveViewId: (id) => activeViewId.set(id),
  setLayout: (layout) => currentLayout.set(layout),
  setLoading: (state) => isLoading.set(state),
  setError: (err) => error.set(err),
  
  // Derived store for current view name
  getCurrentViewName: () => {
    let name = 'Unknown';
    let viewsData = [];
    let activeId = null;
    
    views.subscribe(v => viewsData = v);
    activeViewId.subscribe(id => activeId = id);
    
    return viewsData.find(v => v.id === activeId)?.displayName || name;
  }
};
```

Use in component:

```svelte
<script>
  import { views, activeViewId, categoryStore } from '$stores/categoryStore';
  
  onMount(() => {
    sootElement.addEventListener('loadComplete', async () => {
      const newViews = await sootElement.expose.getViews();
      categoryStore.setViews(newViews);
    });
    
    sootElement.addEventListener('changeLayout', (e) => {
      const layout = e.detail.eventData.layout;
      if (layout.type === 'SAVED_VIEW') {
        categoryStore.setActiveViewId(layout.viewId);
      }
    });
  });
</script>

<!-- Reactive updates -->
{#each $views as view}
  <button class:active={$activeViewId === view.id}>
    {view.displayName}
  </button>
{/each}
```

## 4. Multi-Level Category Organization

Create hierarchical category navigation:

```svelte
<script>
  let expandedCategories = new Set();
  
  // Organize views into groups
  const groupViewsByType = (views) => {
    return views.reduce((acc, view) => {
      const group = view.displayName.split('/')[0] || 'Other';
      if (!acc[group]) acc[group] = [];
      acc[group].push(view);
      return acc;
    }, {});
  };
  
  const toggleGroup = (group) => {
    if (expandedCategories.has(group)) {
      expandedCategories.delete(group);
    } else {
      expandedCategories.add(group);
    }
    expandedCategories = expandedCategories; // Trigger reactivity
  };
  
  $: groupedViews = groupViewsByType(views);
</script>

<nav class="category-tree">
  {#each Object.entries(groupedViews) as [group, groupViews]}
    <div class="category-group">
      <button class="group-header" on:click={() => toggleGroup(group)}>
        <span>{expandedCategories.has(group) ? '▼' : '▶'}</span>
        {group}
        <span class="count">({groupViews.length})</span>
      </button>
      
      {#if expandedCategories.has(group)}
        <ul class="group-items">
          {#each groupViews as view}
            <li>
              <button 
                class:active={activeViewId === view.id}
                on:click={() => switchToView(view.id)}
              >
                {view.displayName.split('/').pop()}
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  {/each}
</nav>

<style>
  .category-tree {
    padding: 1rem;
  }
  
  .category-group {
    margin-bottom: 1rem;
  }
  
  .group-header {
    width: 100%;
    padding: 0.75rem;
    text-align: left;
    background: #f5f5f5;
    border: 1px solid #ddd;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 600;
  }
  
  .count {
    float: right;
    font-size: 0.9rem;
    color: #999;
  }
  
  .group-items {
    list-style: none;
    padding: 0.5rem 0 0 1rem;
    margin: 0;
  }
  
  .group-items button {
    width: 100%;
    padding: 0.5rem;
    text-align: left;
    background: white;
    border: 1px solid #eee;
    border-radius: 3px;
    margin-bottom: 0.25rem;
  }
  
  .group-items button.active {
    background: #e3f2fd;
    border-color: #1976d2;
  }
</style>
```

## 5. Category Preview Thumbnails

Display previews of each category:

```svelte
<script>
  let categoryPreviews = {};
  
  // Generate preview image for each category
  const loadCategoryPreview = async (viewId) => {
    // This would require getting first item of each view
    // and extracting a thumbnail
    try {
      const instanceDetails = await sootElement.expose.getInstanceDetails(viewId);
      categoryPreviews[viewId] = instanceDetails.representation?.url;
    } catch (err) {
      console.error('Failed to load preview:', err);
    }
  };
</script>

<div class="category-grid">
  {#each views as view}
    <div 
      class="category-card"
      class:active={activeViewId === view.id}
      on:click={() => switchToView(view.id)}
    >
      {#if categoryPreviews[view.id]}
        <img src={categoryPreviews[view.id]} alt={view.displayName} />
      {:else}
        <div class="placeholder">
          {#if view.icon}
            <img src={view.icon} alt="" />
          {:else}
            <span>📁</span>
          {/if}
        </div>
      {/if}
      <h4>{view.displayName}</h4>
    </div>
  {/each}
</div>

<style>
  .category-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 1rem;
    padding: 1rem;
  }
  
  .category-card {
    cursor: pointer;
    border: 2px solid transparent;
    border-radius: 8px;
    overflow: hidden;
    transition: all 0.3s ease;
  }
  
  .category-card:hover {
    border-color: #ddd;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  }
  
  .category-card.active {
    border-color: #1976d2;
    box-shadow: 0 4px 12px rgba(25, 118, 210, 0.3);
  }
  
  img {
    width: 100%;
    height: 150px;
    object-fit: cover;
  }
  
  .placeholder {
    width: 100%;
    height: 150px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f5f5f5;
    font-size: 3rem;
  }
  
  h4 {
    margin: 0.75rem 0.5rem;
    font-size: 0.9rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
```

## 6. Search + Category Navigation

Combine category navigation with search:

```svelte
<script>
  let searchActive = false;
  let searchQuery = '';
  
  const handleSearch = async (query) => {
    if (query.trim()) {
      searchActive = true;
      searchQuery = query;
      await sootElement.expose.executeSearch(query);
    }
  };
  
  const handleCategorySelect = (viewId) => {
    searchActive = false;
    searchQuery = '';
    sootElement.expose.setActiveView(viewId);
  };
</script>

<div class="search-and-nav">
  <div class="search-area">
    <input 
      type="text"
      placeholder="Search..."
      on:keydown={(e) => e.key === 'Enter' && handleSearch(e.target.value)}
    />
    {#if searchActive}
      <button on:click={() => handleCategorySelect(views[0]?.id)}>
        Clear search
      </button>
    {/if}
  </div>
  
  {#if !searchActive}
    <nav class="category-nav">
      {#each views as view}
        <button 
          class:active={activeViewId === view.id}
          on:click={() => handleCategorySelect(view.id)}
        >
          {view.displayName}
        </button>
      {/each}
    </nav>
  {/if}
</div>

<style>
  .search-and-nav {
    padding: 1rem;
  }
  
  .search-area {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }
  
  input {
    flex: 1;
    padding: 0.5rem;
    border: 1px solid #ddd;
    border-radius: 4px;
  }
  
  .category-nav {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  
  .category-nav button {
    padding: 0.5rem 1rem;
    background: white;
    border: 1px solid #ddd;
    border-radius: 4px;
    cursor: pointer;
    white-space: nowrap;
  }
  
  .category-nav button.active {
    background: #1976d2;
    color: white;
    border-color: #1976d2;
  }
</style>
```

## 7. Keyboard Navigation

Add keyboard shortcuts for category switching:

```javascript
const setupKeyboardNavigation = (sootElement, views, activeViewId) => {
  const viewIds = views.map(v => v.id);
  let currentIndex = viewIds.indexOf(activeViewId);
  
  document.addEventListener('keydown', (e) => {
    // Cmd/Ctrl + [ to go to previous category
    if ((e.metaKey || e.ctrlKey) && e.key === '[') {
      e.preventDefault();
      currentIndex = (currentIndex - 1 + viewIds.length) % viewIds.length;
      sootElement.expose.setActiveView(viewIds[currentIndex]);
    }
    
    // Cmd/Ctrl + ] to go to next category
    if ((e.metaKey || e.ctrlKey) && e.key === ']') {
      e.preventDefault();
      currentIndex = (currentIndex + 1) % viewIds.length;
      sootElement.expose.setActiveView(viewIds[currentIndex]);
    }
    
    // Cmd/Ctrl + Shift + / to show help
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === '?') {
      e.preventDefault();
      alert(`Keyboard shortcuts:\nCmd/Ctrl + [: Previous category\nCmd/Ctrl + ]: Next category`);
    }
  });
};

// Usage:
setupKeyboardNavigation(sootElement, views, activeViewId);
```

## 8. URL-Based Category Navigation

Sync categories with URL for bookmarking:

```javascript
export const useCategoryUrlSync = (sootElement, views) => {
  const updateUrlForView = (viewId) => {
    const view = views.find(v => v.id === viewId);
    if (view) {
      const slug = view.displayName.toLowerCase().replace(/\s+/g, '-');
      window.history.pushState({}, '', `?view=${slug}`);
    }
  };
  
  const initFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    const viewSlug = params.get('view');
    
    if (viewSlug) {
      const view = views.find(v => 
        v.displayName.toLowerCase().replace(/\s+/g, '-') === viewSlug
      );
      if (view) {
        sootElement.expose.setActiveView(view.id);
      }
    }
  };
  
  sootElement.addEventListener('changeLayout', (e) => {
    if (e.detail.eventData.layout.type === 'SAVED_VIEW') {
      updateUrlForView(e.detail.eventData.layout.viewId);
    }
  });
  
  return { initFromUrl };
};
```

---

These examples demonstrate advanced patterns for working with SOOT categories. Mix and match based on your needs!


