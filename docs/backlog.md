# Calendar Card Pro - Development Backlog

This document captures pending tasks, ideas for improvements, and technical solutions for identified issues.

## Issue: Cache Sharing Between Identical Cards

### Problem Statement

When multiple instances of Calendar Card Pro have identical configuration parameters (entities, days_to_show, show_past_events), they generate the same cache keys in localStorage, resulting in several issues:

1. **Cache Conflicts**: One card instance can overwrite another's cache.
2. **Inconsistent Rendering**: Two identical cards may display different content when they should be in sync.
3. **Race Conditions**: Multiple cards could simultaneously attempt to update the same cache entry.
4. **Unpredictable Behavior**: Which card "wins" when updating the cache is non-deterministic, causing unreliable displays.
5. **Cross-Dashboard Interference**: Cards on completely different dashboards can interfere with each other if they share configuration.

Current workarounds (using instanceId based on configuration) still allow identical cards to share caches, which doesn't fully resolve the issue.

### Proposed Solution: Card Instance Registry

The Card Instance Registry would maintain a persistent mapping between card configuration signatures and unique identifiers, ensuring that even identical cards maintain separate caches.

#### Implementation Details:

1. **Registry Storage**:

   ```typescript
   // Structure in localStorage
   calendar_card_registry: {
     "calendar.family_calendar.work_7_0": ["unique-id-1", "unique-id-2"],  // Multiple cards with same config
     "calendar.personal_3_1": ["unique-id-3"] // Only one card with this config
   }
   ```

2. **Unique ID Generation**:

   ```typescript
   function getUniqueCardId(config) {
     // Generate base config key (entities + days_to_show + show_past_events)
     const baseKey = getBaseCacheKey(config.entities, config.days_to_show, config.show_past_events);

     // Check if we've seen cards with this configuration before
     const registry = JSON.parse(localStorage.getItem('calendar_card_registry') || '{}');
     const configInstances = registry[baseKey] || [];

     // First time we've seen this card configuration
     if (configInstances.length === 0) {
       // Create a unique ID using timestamp + random component
       const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

       // Register this card instance
       registry[baseKey] = [uniqueId];
       localStorage.setItem('calendar_card_registry', JSON.stringify(registry));
       return uniqueId;
     }

     // Create a new instance ID for this configuration
     const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
     configInstances.push(uniqueId);
     registry[baseKey] = configInstances;
     localStorage.setItem('calendar_card_registry', JSON.stringify(registry));

     return uniqueId;
   }
   ```

3. **Card Position Recognition**:

   ```typescript
   function recoverCardPosition() {
     // This would use heuristics to determine which registered ID
     // this specific card instance corresponds to after a page reload
     // Approach 1: Use order of appearance in DOM
     // Count how many cards with same config appeared before this one
     // Approach 2: Try to use spatial coordinates or DOM path as hints
     // Approach 3: Use local storage at component level to remember position
   }
   ```

4. **Cache Key Generation with Instance ID**:
   ```typescript
   function getInstanceSpecificCacheKey(instanceId, baseKey) {
     return `${Constants.CACHE.EVENT_CACHE_KEY_PREFIX}${instanceId}_${baseKey}`;
   }
   ```

### Benefits

1. **Complete Isolation**: Each card instance gets its own fully isolated cache.
2. **Persistence**: Card identities persist across page reloads.
3. **Performance**: Maintains the performance benefits of caching.
4. **Reliability**: Eliminates race conditions and cache conflicts.

### Implementation Considerations

1. **Storage Growth**: The registry will grow over time - need cleanup mechanism.
2. **Position Recovery**: After page reload, determining which registered ID corresponds to which card instance can be challenging.
3. **Migration**: Need strategy for handling existing cache entries.

### Impact on Current Solution

This solution would build on top of the simpler instance-specific cache keys, providing a more robust, long-term solution for persistent card identities across page reloads while maintaining complete cache isolation.
