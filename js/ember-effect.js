// ember-effect.js
function createFireEffect() {
  const container = document.querySelector('.fire-container');
  const MAX_EMBERS = 30;
  
  function spawnEmber() {
    if (container.childNodes.length >= MAX_EMBERS) return;
    
    const ember = document.createElement('div');
    ember.className = 'ember';
    
    const startX = Math.random() * 100;
    const duration = 4 + Math.random() * 2;
    const drift = -50 + Math.random() * 100;
    
    ember.style.cssText = `
      left: ${startX}%;
      animation-duration: ${duration}s;
      --drift: ${drift}px;
    `;
    
    container.appendChild(ember);
    
    ember.addEventListener('animationend', () => {
      ember.remove();
    });
  }
  
  // Spawn embers continuously
  setInterval(spawnEmber, 200);
}

const template = `
<div class="fire-container">
  <div class="heat-effect">
    <div class="heat-layer heat-primary"></div>
    <div class="heat-layer heat-secondary"></div>
  </div>
</div>
`;

// Initialize when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Add the template to the body
  document.body.insertAdjacentHTML('beforeend', template);
  // Start the effect
  createFireEffect();
});
