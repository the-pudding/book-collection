# SOOT WebComponents - Troubleshooting Guide

## Common Issues & Solutions

### 1. Categories Not Loading

**Symptoms:**
- Sidebar shows "Loading categories..." indefinitely
- No categories appear in the list
- Console doesn't log "📚 Found X categories"

**Solutions:**

```javascript
// Check 1: Verify loadComplete event fires
sootElement.addEventListener('loadComplete', (e) => {
  console.log('✅ loadComplete fired');
  console.log('Event detail:', e.detail);
});

// Check 2: Call getViews() manually
setTimeout(async () => {
  try {
    const views = await sootElement.expose.getViews();
    console.log('✅ getViews() successful:', views);
  } catch (err) {
    console.error('❌ getViews() failed:', err);
  }
}, 2000);

// Check 3: Verify space slug is correct
console.log('Space slug:', sootElement.getAttribute('slug'));
```

**Common Causes:**
- Space hasn't finished loading (wait for `loadComplete`)
- Space slug is invalid or doesn't exist
- Network request failed (check Network tab)
- SOOT backend is down

---

### 2. Category Click Doesn't Switch View

**Symptoms:**
- Clicking category button does nothing
- No console message about switching
- UI doesn't update

**Solutions:**

```javascript
// Check 1: Verify expose is available
console.log('expose available?', sootElement?.expose);
console.log('setActiveView available?', sootElement?.expose?.setActiveView);

// Check 2: Verify view ID is valid
console.log('Valid view IDs:', views.map(v => v.id));
console.log('Attempting to switch to:', viewId);

// Check 3: Call setActiveView directly
sootElement.expose.setActiveView('known-valid-id');

// Check 4: Check if changeLayout event fires
sootElement.addEventListener('changeLayout', (e) => {
  console.log('✅ changeLayout event fired after switch');
  console.log('New layout:', e.detail.eventData.layout);
});
```

**Common Causes:**
- `sootElement.expose` is undefined (element hasn't loaded)
- View ID doesn't exist in the space
- View ID is from a different space
- Event listener not attached

---

### 3. Console Logs Not Appearing

**Symptoms:**
- No emoji indicators (✨, 📚, 🔄, etc.)
- Console is empty or only shows SOOT's logs
- Can't tell what's happening

**Solutions:**

```javascript
// Check 1: Verify onMount is running
console.log('Component mounted');

// Check 2: Verify browser flag
console.log('browser flag:', browser); // Should be true after mount

// Check 3: Check for errors
window.addEventListener('error', (e) => {
  console.error('Global error:', e.error);
});

// Check 4: Force a console log
setTimeout(() => {
  console.log('⚠️ Force log after 1s');
}, 1000);
```

**Common Causes:**
- Code running before `onMount`
- `browser` flag is false in SSR
- Errors preventing execution (check Network tab)
- Console is showing wrong filter

---

### 4. Active Category Not Highlighted

**Symptoms:**
- All category buttons look the same
- Blue highlight doesn't appear on active category
- Can't tell which view you're in

**Solutions:**

```javascript
// Check 1: Verify activeViewId is being set
sootElement.addEventListener('changeLayout', (e) => {
  const layout = e.detail.eventData.layout;
  console.log('Layout type:', layout.type);
  
  if (layout.type === 'SAVED_VIEW') {
    console.log('✅ Setting activeViewId to:', layout.viewId);
    activeViewId = layout.viewId;
  } else {
    console.log('🔍 Search mode, activeViewId = null');
    activeViewId = null;
  }
});

// Check 2: Check Svelte reactivity
$: console.log('activeViewId changed to:', activeViewId);

// Check 3: Inspect CSS classes
const button = document.querySelector('.category-button');
console.log('Classes:', button?.className);
console.log('Has .active?', button?.classList.contains('active'));

// Check 4: Test CSS
const testButton = document.querySelector('.category-button.active');
console.log('Found active button?', testButton ? '✅' : '❌');
```

**Common Causes:**
- `activeViewId` not updating when layout changes
- CSS `.active` class not applied correctly
- Browser CSS not loading
- Svelte reactivity not triggered

---

### 5. SOOT Publication Not Visible

**Symptoms:**
- Gray area where publication should be
- Canvas doesn't render
- 3D view is blank

**Solutions:**

```javascript
// Check 1: Verify element rendered
console.log('Element exists?', sootElement ? '✅' : '❌');

// Check 2: Check dimensions
const rect = sootElement.getBoundingClientRect();
console.log('Position:', rect.x, rect.y);
console.log('Size:', rect.width, 'x', rect.height);

if (rect.width === 0 || rect.height === 0) {
  console.error('❌ Element has no size!');
}

// Check 3: Check shadow DOM
console.log('Shadow root:', sootElement.shadowRoot ? '✅' : '❌');
console.log('Canvas element:', 
  sootElement.shadowRoot?.querySelector('canvas') ? '✅' : '❌');

// Check 4: Check CSS
const style = window.getComputedStyle(sootElement);
console.log('Display:', style.display);
console.log('Visibility:', style.visibility);
console.log('Opacity:', style.opacity);
console.log('Width:', style.width);
console.log('Height:', style.height);

// Check 5: Verify space content
sootElement.addEventListener('loadComplete', (e) => {
  console.log('Layout after load:', e.detail.eventData.layout);
});
```

**Common Causes:**
- Parent container has zero dimensions
- CSS `display: none` or `visibility: hidden`
- Element is off-screen
- Space has no content loaded
- GPU acceleration disabled

---

### 6. Search Not Working

**Symptoms:**
- Typing in search doesn't work
- Search button doesn't appear
- Results don't update

**Solutions:**

```javascript
// Check 1: Try executeSearch manually
sootElement.expose.executeSearch('test query')
  .then(() => console.log('✅ Search executed'))
  .catch(err => console.error('❌ Search failed:', err));

// Check 2: Listen for search results
sootElement.addEventListener('changeLayout', (e) => {
  const layout = e.detail.eventData.layout;
  if (layout.type === 'SEARCH') {
    console.log('✅ Search results received');
    console.log('Query type:', layout.query.type);
    console.log('Query:', layout.query);
  }
});

// Check 3: Check autocompletions
const suggestions = sootElement.expose.getAutocompletions('test');
console.log('Autocomplete suggestions:', suggestions);

// Check 4: Verify search bar is visible
const searchBar = sootElement.shadowRoot?.querySelector('[slot="omnibar"]');
console.log('Search bar exists?', searchBar ? '✅' : '❌');
```

**Common Causes:**
- Space doesn't have search enabled
- Search bar is hidden or replaced
- API endpoint issues
- Invalid search query

---

### 7. Memory Leaks or Performance Issues

**Symptoms:**
- Page gets slower over time
- Memory usage grows continuously
- Frame rate drops

**Solutions:**

```javascript
// Check 1: Monitor event listeners
let eventCount = 0;
const originalAdd = sootElement.addEventListener;
sootElement.addEventListener = function(type, listener, options) {
  eventCount++;
  console.log(`Event listener added (total: ${eventCount}):`, type);
  return originalAdd.call(this, type, listener, options);
};

// Check 2: Check if cleanup is needed
// Make sure to clean up on unmount:
onUnmount(() => {
  // Remove listeners if component is destroyed
  console.log('Cleaning up...');
});

// Check 3: Monitor memory
if (performance.memory) {
  setInterval(() => {
    console.log('Memory:', {
      used: Math.round(performance.memory.usedJSHeapSize / 1048576) + 'MB',
      limit: Math.round(performance.memory.jsHeapSizeLimit / 1048576) + 'MB'
    });
  }, 5000);
}

// Check 4: Profile in DevTools
// Chrome: DevTools > Performance > Record
```

**Common Causes:**
- Multiple event listeners attached (duplicates)
- Large view arrays not garbage collected
- Three.js resources not cleaned up
- Memory retained by closed overlays

---

### 8. Mobile Responsiveness Issues

**Symptoms:**
- Categories not visible on mobile
- Layout is broken
- Touch interactions don't work

**Solutions:**

```javascript
// Check 1: Verify viewport meta tag
const viewport = document.querySelector('meta[name="viewport"]');
console.log('Viewport meta:', viewport?.content);

// Check 2: Test media query
const isMobile = window.innerWidth <= 768;
console.log('Is mobile?', isMobile);

// Check 3: Check touch support
console.log('Touch events supported?', 'ontouchstart' in window);

// Check 4: Listen for orientation changes
window.addEventListener('orientationchange', () => {
  console.log('Orientation changed');
  // Resize SOOT publication
  sootElement.style.width = '100%';
  sootElement.style.height = window.innerHeight + 'px';
});

// Check 5: Manual viewport test
console.log('Window size:', window.innerWidth, 'x', window.innerHeight);
const elSize = sootElement.getBoundingClientRect();
console.log('Element size:', elSize.width, 'x', elSize.height);
```

**Common Causes:**
- Missing viewport meta tag
- CSS media queries not working
- Touch events not handled
- Viewport doesn't resize on orientation change

---

### 9. Events Not Firing

**Symptoms:**
- Event listeners added but never called
- "changeLayout" never logs
- "loadComplete" never fires

**Solutions:**

```javascript
// Check 1: Verify listeners are attached correctly
const listeners = getEventListeners(sootElement); // Chrome only
console.log('Event listeners:', listeners);

// Check 2: Add diagnostic listeners
['loadComplete', 'changeLayout', 'selectInstance', 'deselectInstance'].forEach(event => {
  sootElement.addEventListener(event, (e) => {
    console.log(`✅ Event fired: ${event}`);
  });
});

// Check 3: Verify event object structure
sootElement.addEventListener('changeLayout', (e) => {
  console.log('Event object:', {
    type: e.type,
    detail: e.detail,
    eventData: e.detail?.eventData,
    layout: e.detail?.eventData?.layout
  });
});

// Check 4: Check for event bubbling issues
sootElement.addEventListener('changeLayout', (e) => {
  console.log('Bubbles?', e.bubbles);
  console.log('Cancelable?', e.cancelable);
});
```

**Common Causes:**
- Event listeners attached before SOOT loads
- Wrong event name (typo)
- Events are CustomEvents with different structure
- Event bubbling blocked

---

### 10. CSS Styling Not Applied

**Symptoms:**
- Colors not changing
- Layout is broken
- Custom styles ignored

**Solutions:**

```javascript
// Check 1: Verify CSS is loaded
const styles = document.querySelectorAll('style');
console.log('Style tags found:', styles.length);

// Check 2: Check CSS variables
const computed = getComputedStyle(sootElement);
console.log('CSS variables:', {
  fontFamily: computed.getPropertyValue('--soot-sans-serif-font-family'),
  textColor: computed.getPropertyValue('--soot-default-text-color'),
  background: computed.getPropertyValue('--soot-highlighted-background')
});

// Check 3: Override CSS programmatically
sootElement.style.setProperty('--soot-default-text-color', 'red');

// Check 4: Check shadow DOM styles
const shadowStyles = sootElement.shadowRoot?.querySelectorAll('style');
console.log('Shadow DOM styles:', shadowStyles?.length);

// Check 5: Inspect element in DevTools
// Right-click element > Inspect > Check Styles panel
```

**Common Causes:**
- CSS not loaded before component renders
- CSS variables not supported (old browser)
- Shadow DOM styles isolated
- Selector specificity issues

---

## Debug Utilities

### Create a Debug Panel

```javascript
// Add to your component
function setupDebugPanel() {
  const debugInfo = {
    viewsCount: () => views.length,
    activeView: () => views.find(v => v.id === activeViewId)?.displayName,
    currentLayoutType: () => currentLayout?.type,
    isLoading,
    error,
    viewIds: () => views.map(v => v.id),
    allData: () => ({
      views,
      activeViewId,
      currentLayout,
      isLoading,
      error
    })
  };
  
  // Expose to window for console access
  window.sootDebug = debugInfo;
  
  // Or create UI
  console.table(debugInfo);
  
  return debugInfo;
}

// Use: window.sootDebug.allData() in console
```

### Real-time Monitoring

```javascript
// Auto-log state changes
let lastState = null;
setInterval(() => {
  const currentState = {
    views: views.length,
    activeViewId,
    layoutType: currentLayout?.type,
    isLoading
  };
  
  if (JSON.stringify(currentState) !== JSON.stringify(lastState)) {
    console.log('State changed:', currentState);
    lastState = currentState;
  }
}, 1000);
```

---

## Browser DevTools Tips

### Chrome DevTools
```
1. Console: Check for errors
2. Network: Monitor API calls
3. Performance: Profile slow interactions
4. Elements: Inspect shadow DOM
5. Sources: Set breakpoints in code
```

### Firefox DevTools
```
1. Console: Same as Chrome
2. Network: Same as Chrome
3. Performance: Same as Chrome
4. Inspector: Click element picker to inspect shadow DOM
```

### Safari DevTools
```
1. Enable: Preferences > Advanced > Show Develop menu
2. Develop > Show Web Inspector
3. Console, Network, Elements tabs available
```

---

## Getting Help

When reporting issues:

1. **Provide Console Output**
   ```javascript
   // Copy all console logs
   console.log(JSON.stringify({
     views: views.length,
     activeViewId,
     error,
     isLoading
   }));
   ```

2. **Share Browser Info**
   ```javascript
   console.log(navigator.userAgent);
   ```

3. **Share SOOT Version**
   ```javascript
   // Check package.json
   console.log('SOOT version: 0.1.2');
   ```

4. **Describe Steps to Reproduce**
   - What did you do?
   - What happened?
   - What should happen?

---

## Performance Optimization Tips

### 1. Lazy Load Categories
```javascript
// Only render visible categories
const visibleCategories = views.slice(0, 10);
```

### 2. Debounce Search
```javascript
const debouncedSearch = debounce((query) => {
  sootElement.expose.executeSearch(query);
}, 500);
```

### 3. Cache View Data
```javascript
const viewCache = new Map();
if (!viewCache.has('views')) {
  const views = await sootElement.expose.getViews();
  viewCache.set('views', views);
}
```

### 4. Monitor Frame Rate
```javascript
let fps = 0;
let lastTime = Date.now();
function updateFPS() {
  const currentTime = Date.now();
  fps = Math.round(1000 / (currentTime - lastTime));
  lastTime = currentTime;
  requestAnimationFrame(updateFPS);
}
```

---

## Still Stuck?

1. Check all documentation files
2. Review SOOT_QUICK_REFERENCE.md
3. Look at SOOT_ADVANCED_EXAMPLES.md
4. Search GitHub issues
5. Contact SOOT support

Good luck! 🎨


