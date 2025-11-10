// Advanced Aimbot Script v2.0 - Enhanced Features
(function() {
  'use strict';

  // Configuration
  const CONFIG = {
    // Targeting settings
    enemySelector: '.enemy-player',
    friendlySelector: '.friendly-player', // Avoid targeting friends
    scanInterval: 16, // ~60fps for smoother operation
    aimOffset: { x: 0, y: -20 }, // Headshot offset (adjust as needed)
    
    // Activation controls
    activationKey: 'Shift',
    toggleMode: false, // False = hold to activate, True = toggle on/off
    
    // Aiming behavior
    fovRadius: 300, // Field of view restriction (pixels)
    smoothAiming: true, // Smooth vs instant aiming
    smoothingFactor: 0.3, // Lower = slower, Higher = faster (0.1 - 1.0)
    prediction: true, // Predictive targeting
    predictionFactor: 0.2, // Movement prediction strength
    
    // Trigger settings
    autoShoot: false, // Automatically shoot when aimed
    triggerDelay: { min: 50, max: 150 }, // Random delay to seem human
    
    // Performance & Debugging
    enableLogging: false,
    drawFOV: false, // Visualize FOV circle
    maxTargets: 10 // Limit targets for performance
  };

  // State management
  let isActive = false;
  let isAiming = false;
  let lastTarget = null;
  let lastPosition = { x: 0, y: 0 };
  let targetHistory = [];

  // Utility functions
  const log = (...args) => CONFIG.enableLogging && console.log('[Advanced Aimbot]', ...args);

  // Vector math utilities
  const Vector = {
    distance: (a, b) => Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2),
    normalize: (vec) => {
      const len = Math.sqrt(vec.x ** 2 + vec.y ** 2);
      return len > 0 ? { x: vec.x / len, y: vec.y / len } : { x: 0, y: 0 };
    },
    multiply: (vec, scalar) => ({ x: vec.x * scalar, y: vec.y * scalar })
  };

  // Screen center point
  const getScreenCenter = () => ({
    x: window.innerWidth / 2,
    y: window.innerHeight / 2
  });

  // Enhanced enemy detection with FOV and visibility checks
  const detectEnemies = () => {
    const enemies = document.querySelectorAll(CONFIG.enemySelector);
    const friendlies = document.querySelectorAll(CONFIG.friendlySelector);
    const center = getScreenCenter();
    const validTargets = [];

    // Convert friendlies to a Set for fast lookup
    const friendlyElements = new Set(Array.from(friendlies));

    for (let i = 0; i < Math.min(enemies.length, CONFIG.maxTargets); i++) {
      const enemy = enemies[i];
      
      // Skip invalid or friendly elements
      if (!enemy.offsetParent || enemy.style.display === 'none' || friendlyElements.has(enemy)) {
        continue;
      }

      const rect = enemy.getBoundingClientRect();
      const targetPos = {
        x: rect.left + rect.width / 2 + CONFIG.aimOffset.x,
        y: rect.top + rect.height / 2 + CONFIG.aimOffset.y
      };

      // Check if within FOV
      const distance = Vector.distance(center, targetPos);
      if (distance <= CONFIG.fovRadius) {
        validTargets.push({
          element: enemy,
          position: targetPos,
          distance: distance,
          rect: rect
        });
      }
    }

    return validTargets;
  };

  // Predictive targeting based on movement history
  const predictTargetPosition = (target) => {
    if (!CONFIG.prediction || targetHistory.length < 2) return target.position;

    // Calculate velocity from history
    const recent = targetHistory.slice(-3);
    if (recent.length < 2) return target.position;

    let totalVelocity = { x: 0, y: 0 };
    for (let i = 1; i < recent.length; i++) {
      totalVelocity.x += recent[i].x - recent[i - 1].x;
      totalVelocity.y += recent[i].y - recent[i - 1].y;
    }

    const avgVelocity = {
      x: totalVelocity.x / (recent.length - 1),
      y: totalVelocity.y / (recent.length - 1)
    };

    // Apply prediction factor
    return {
      x: target.position.x + avgVelocity.x * CONFIG.predictionFactor,
      y: target.position.y + avgVelocity.y * CONFIG.predictionFactor
    };
  };

  // Select optimal target based on priority factors
  const selectOptimalTarget = (targets) => {
    if (targets.length === 0) return null;

    const center = getScreenCenter();
    
    // Priority scoring system:
    // 1. Closest to crosshair
    // 2. Within FOV center (bonus for being near center)
    // 3. Recently targeted (sticky targeting)
    
    return targets.reduce((best, current) => {
      // Base score by distance (lower is better)
      let currentScore = current.distance;
      
      // Bonus for being close to screen center
      const centerDistance = Vector.distance(center, current.position);
      if (centerDistance < CONFIG.fovRadius * 0.3) {
        currentScore *= 0.8; // 20% bonus for center proximity
      }
      
      // Sticky targeting bonus
      if (lastTarget && current.element === lastTarget.element) {
        currentScore *= 0.9; // 10% bonus for sticking to same target
      }
      
      return currentScore < best.score ? { target: current, score: currentScore } : best;
    }, { target: targets[0], score: Infinity }).target;
  };

  // Smooth aiming with interpolation
  const smoothAimTo = (targetPos) => {
    const center = getScreenCenter();
    const deltaX = targetPos.x - center.x;
    const deltaY = targetPos.y - center.y;
    
    if (CONFIG.smoothAiming) {
      // Apply smoothing factor
      const smoothX = center.x + deltaX * CONFIG.smoothingFactor;
      const smoothY = center.y + deltaY * CONFIG.smoothingFactor;
      return { x: smoothX, y: smoothY };
    }
    
    return targetPos;
  };

  // Simulate human-like mouse movement
  const moveMouse = (targetPos) => {
    if (isAiming) return;
    
    isAiming = true;
    
    // Update target history for prediction
    targetHistory.push({ ...targetPos, timestamp: Date.now() });
    if (targetHistory.length > 10) {
      targetHistory.shift();
    }
    
    // Get predicted position
    const predictedPos = predictTargetPosition({ position: targetPos });
    
    // Apply smoothing
    const finalPos = smoothAimTo(predictedPos);
    
    // Dispatch mouse move event
    const mouseMoveEvent = new MouseEvent('mousemove', {
      clientX: finalPos.x,
      clientY: finalPos.y,
      bubbles: true,
      cancelable: true
    });
    
    document.dispatchEvent(mouseMoveEvent);
    
    // Update last position
    lastPosition = finalPos;
    
    // Handle auto-shooting
    if (CONFIG.autoShoot && lastTarget) {
      const delay = Math.random() * (CONFIG.triggerDelay.max - CONFIG.triggerDelay.min) + CONFIG.triggerDelay.min;
      setTimeout(() => {
        if (isActive) {
          lastTarget.element.click();
          log('Auto-fired at target');
        }
      }, delay);
    }
    
    // Reset aiming flag
    setTimeout(() => { isAiming = false; }, 16); // ~1 frame
  };

  // Draw FOV visualization (for debugging)
  const drawFOV = () => {
    if (!CONFIG.drawFOV) return;
    
    const canvas = document.getElementById('aimbot-fov-canvas') || (() => {
      const c = document.createElement('canvas');
      c.id = 'aimbot-fov-canvas';
      c.style.position = 'fixed';
      c.style.top = '0';
      c.style.left = '0';
      c.style.pointerEvents = 'none';
      c.style.zIndex = '9999';
      document.body.appendChild(c);
      return c;
    })();
    
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const center = getScreenCenter();
    
    // Draw FOV circle
    ctx.beginPath();
    ctx.arc(center.x, center.y, CONFIG.fovRadius, 0, 2 * Math.PI);
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Draw center crosshair
    ctx.beginPath();
    ctx.moveTo(center.x - 10, center.y);
    ctx.lineTo(center.x + 10, center.y);
    ctx.moveTo(center.x, center.y - 10);
    ctx.lineTo(center.x, center.y + 10);
    ctx.strokeStyle = 'rgba(0, 255, 0, 0.7)';
    ctx.lineWidth = 1;
    ctx.stroke();
  };

  // Main targeting loop
  const update = () => {
    // Clear FOV visualization if disabled
    if (!CONFIG.drawFOV) {
      const canvas = document.getElementById('aimbot-fov-canvas');
      if (canvas) canvas.remove();
    } else {
      drawFOV();
    }
    
    if (!isActive) {
      lastTarget = null;
      return;
    }
    
    // Detect and prioritize targets
    const targets = detectEnemies();
    if (targets.length === 0) {
      lastTarget = null;
      return;
    }
    
    // Select best target
    const target = selectOptimalTarget(targets);
    if (!target) return;
    
    lastTarget = target;
    
    // Move mouse to target
    moveMouse(target.position);
    
    log(`Targeting: ${target.distance.toFixed(1)}px away`);
  };

  // Toggle activation mode
  const toggleActive = () => {
    isActive = !isActive;
    log(isActive ? 'Aimbot ENABLED' : 'Aimbot DISABLED');
    
    // Visual feedback
    if (isActive) {
      document.body.style.border = '2px solid red';
      setTimeout(() => {
        document.body.style.border = '';
      }, 200);
    }
  };

  // Event listeners
  document.addEventListener('keydown', (e) => {
    if (e.key === CONFIG.activationKey) {
      if (CONFIG.toggleMode) {
        if (e.repeat) return; // Prevent toggle spam
        toggleActive();
      } else {
        isActive = true;
        log('Aimbot activated (hold mode)');
      }
    }
  });

  document.addEventListener('keyup', (e) => {
    if (e.key === CONFIG.activationKey && !CONFIG.toggleMode) {
      isActive = false;
      isAiming = false;
      log('Aimbot deactivated');
    }
  });

  // Initialize
  log('Advanced Aimbot v2.0 loaded');
  log(`Controls: ${CONFIG.toggleMode ? 'Toggle' : 'Hold'} ${CONFIG.activationKey} to activate`);
  
  // Start main loop
  setInterval(update, CONFIG.scanInterval);
})();

// Simple but effective aimbot script - Auto-activated
(function() {
  // Configuration
  const CONFIG = {
    enemySelector: '.enemy-player',
    aimOffset: { x: 0, y: -20 }, // Aim 20 pixels above center for headshots
    scanInterval: 50
  };

  // No need for activation key - always active
  let isActive = true; // Always true now

  // Find the closest enemy to the center of the screen
  function findClosestEnemy() {
    const enemies = document.querySelectorAll(CONFIG.enemySelector);
    if (enemies.length === 0) return null;

    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    let closestEnemy = null;
    let minDistance = Infinity;

    enemies.forEach(enemy => {
      // Skip hidden enemies
      if (!enemy.offsetParent || enemy.style.display === 'none') return;

      const rect = enemy.getBoundingClientRect();
      const targetX = rect.left + rect.width / 2 + CONFIG.aimOffset.x;
      const targetY = rect.top + rect.height / 2 + CONFIG.aimOffset.y;

      // Calculate distance from center of screen
      const distance = Math.sqrt(
        Math.pow(targetX - centerX, 2) + 
        Math.pow(targetY - centerY, 2)
      );

      if (distance < minDistance) {
        minDistance = distance;
        closestEnemy = { element: enemy, x: targetX, y: targetY, distance };
      }
    });

    return closestEnemy;
  }

  // Move mouse to target position
  function aimAtTarget(target) {
    if (!target) return;

    // Create mouse move event
    const mouseMoveEvent = new MouseEvent('mousemove', {
      clientX: target.x,
      clientY: target.y,
      bubbles: true
    });

    // Dispatch the event
    document.dispatchEvent(mouseMoveEvent);
  }

  // Main update loop
  function update() {
    // Always active - no key required
    if (!isActive) return;

    const target = findClosestEnemy();
    if (target) {
      aimAtTarget(target);
      console.log('Aiming at enemy:', target.distance.toFixed(2) + 'px away');
    }
  }

  // Start the loop immediately - no key press needed
  setInterval(update, CONFIG.scanInterval);
  console.log('Aimbot loaded and running automatically');
})();

// Safe aimbot script - avoids pointer lock issues
(function() {
  // Configuration
  const CONFIG = {
    enemySelector: '.enemy-player',
    aimOffset: { x: 0, y: -20 },
    scanInterval: 100, // Slower scan to reduce CPU usage
    enableClick: true // Enable clicking on targets
  };

  console.log('Safe Aimbot loaded');

  // Find the closest enemy to the center of the screen
  function findClosestEnemy() {
    const enemies = document.querySelectorAll(CONFIG.enemySelector);
    if (enemies.length === 0) return null;

    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    let closestEnemy = null;
    let minDistance = Infinity;

    enemies.forEach(enemy => {
      // Skip hidden enemies
      if (!enemy.offsetParent || enemy.style.display === 'none') return;

      const rect = enemy.getBoundingClientRect();
      const targetX = rect.left + rect.width / 2 + CONFIG.aimOffset.x;
      const targetY = rect.top + rect.height / 2 + CONFIG.aimOffset.y;

      // Calculate distance from center of screen
      const distance = Math.sqrt(
        Math.pow(targetX - centerX, 2) + 
        Math.pow(targetY - centerY, 2)
      );

      if (distance < minDistance) {
        minDistance = distance;
        closestEnemy = { element: enemy, x: targetX, y: targetY, distance };
      }
    });

    return closestEnemy;
  }

  // Simple click-based targeting (avoids pointer lock issues)
  function aimAtTarget(target) {
    if (!target) return;

    // Option 1: Direct click on enemy (safest method)
    if (CONFIG.enableClick) {
      // Create a temporary invisible overlay to simulate clicks
      const overlay = document.createElement('div');
      overlay.style.position = 'fixed';
      overlay.style.left = (target.x - 5) + 'px';
      overlay.style.top = (target.y - 5) + 'px';
      overlay.style.width = '10px';
      overlay.style.height = '10px';
      overlay.style.backgroundColor = 'transparent';
      overlay.style.pointerEvents = 'none';
      overlay.style.zIndex = '999999';
      document.body.appendChild(overlay);

      // Trigger click on the overlay (which is positioned over the enemy)
      overlay.click();
      
      // Clean up
      setTimeout(() => {
        if (overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
      }, 100);
      
      console.log('Target clicked:', target.distance.toFixed(2) + 'px away');
    }
  }

  // Main update loop
  function update() {
    const target = findClosestEnemy();
    if (target) {
      aimAtTarget(target);
    }
  }

  // Start the loop
  setInterval(update, CONFIG.scanInterval);
  console.log('Aimbot running - targeting enemies automatically');
})();
