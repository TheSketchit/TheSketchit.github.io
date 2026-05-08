const Vec2 = require('./vec2.js');

function assert(condition, message) {
    if (!condition) {
        throw new Error(message || "Assertion failed");
    }
}

function testVec2() {
    console.log("Running Vec2 tests...");

    // Test magnitude
    const v1 = new Vec2(3, 4);
    assert(v1.mag() === 5, "v1 magnitude should be 5");

    // Test normalization (happy path)
    const v2 = new Vec2(3, 0);
    const n2 = v2.norm();
    assert(n2.x === 1 && n2.y === 0, "n2 should be (1,0)");

    // Test normalization (zero vector edge case)
    const v0 = new Vec2(0, 0);
    const n0 = v0.norm();
    assert(n0.x === 0 && n0.y === 0, "n0 should be (0,0) for zero vector");
    assert(!isNaN(n0.x) && !isNaN(n0.y), "n0 should not contain NaN");

    console.log("All Vec2 tests passed!");
}

try {
    testVec2();
} catch (e) {
    console.error("Test failed: " + e.message);
    process.exit(1);
}
