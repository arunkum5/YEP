const { spawn } = require('child_process');
const http = require('http');

const PORT = 8788;
const BASE_URL = `http://localhost:${PORT}`;

// A simple mock base64 image (1x1 transparent JPEG pixel)
const MOCK_IMAGE = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper to wait until the local server is reachable
async function waitForServer(url, retries = 15) {
  for (let i = 0; i < retries; i++) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(url, (res) => {
          resolve();
        });
        req.on('error', reject);
        req.end();
      });
      console.log("⚡ Dev server is ready!");
      return true;
    } catch (err) {
      await wait(1000);
    }
  }
  throw new Error("Timeout waiting for dev server to start.");
}

async function runTests() {
  console.log("🏁 Starting API Integration Tests...");
  
  let uploadResult;
  
  // 1. Test Preflight OPTIONS Request
  console.log("\n🧪 Test 1: OPTIONS Preflight Request");
  const optionsRes = await fetch(`${BASE_URL}/api/upload`, {
    method: 'OPTIONS'
  });
  if (optionsRes.status !== 200) throw new Error(`OPTIONS preflight failed: ${optionsRes.status}`);
  const allowHeaders = optionsRes.headers.get('Access-Control-Allow-Headers');
  console.log(`Access-Control-Allow-Headers: ${allowHeaders}`);
  if (!allowHeaders || !allowHeaders.includes('Authorization')) {
    throw new Error("CORS preflight missing 'Authorization' header permission!");
  }
  console.log("✅ OPTIONS Preflight passed.");

  // 2. Test Photo Upload (POST)
  console.log("\n🧪 Test 2: Photo Upload (POST)");
  const uploadRes = await fetch(`${BASE_URL}/api/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename: "9448610107_photo.jpg",
      image: MOCK_IMAGE
    })
  });
  
  if (uploadRes.status !== 200) {
    const errorText = await uploadRes.text();
    throw new Error(`Upload failed with status ${uploadRes.status}: ${errorText}`);
  }
  
  uploadResult = await uploadRes.json();
  console.log("Upload Response:", uploadResult);
  if (!uploadResult.success || !uploadResult.photo_url || !uploadResult.signature) {
    throw new Error("Upload response missing critical fields (success, photo_url, or signature)!");
  }
  console.log("✅ Photo Upload passed.");

  const filename = uploadResult.photo_url.split('/').pop();

  // 3. Test Unauthorized Delete (DELETE without signature or auth header)
  console.log("\n🧪 Test 3: Unauthorized Delete (DELETE)");
  const unauthDeleteRes = await fetch(`${BASE_URL}/api/upload?filename=${encodeURIComponent(filename)}`, {
    method: 'DELETE'
  });
  console.log(`Status code (expected 401): ${unauthDeleteRes.status}`);
  if (unauthDeleteRes.status !== 401) {
    throw new Error(`Expected status 401 for unauthorized delete, but got ${unauthDeleteRes.status}`);
  }
  console.log("✅ Unauthorized Delete rejected successfully.");

  // 4. Test Signature-authorized Delete (DELETE with correct signature)
  console.log("\n🧪 Test 4: Signature-authorized Delete (DELETE)");
  const authDeleteRes = await fetch(
    `${BASE_URL}/api/upload?filename=${encodeURIComponent(filename)}&signature=${uploadResult.signature}`, 
    { method: 'DELETE' }
  );
  console.log(`Status code (expected 200): ${authDeleteRes.status}`);
  if (authDeleteRes.status !== 200) {
    const errText = await authDeleteRes.text();
    throw new Error(`Expected status 200 for signed delete, but got ${authDeleteRes.status}: ${errText}`);
  }
  console.log("✅ Signature-authorized Delete completed successfully.");

  // 5. Test Token-unauthorized Delete (DELETE with fake Bearer token)
  console.log("\n🧪 Test 5: Token-unauthorized Delete (DELETE)");
  const tokenDeleteRes = await fetch(`${BASE_URL}/api/upload?filename=${encodeURIComponent(filename)}`, {
    method: 'DELETE',
    headers: { 'Authorization': 'Bearer invalid_mock_token' }
  });
  console.log(`Status code (expected 401): ${tokenDeleteRes.status}`);
  if (tokenDeleteRes.status !== 401) {
    throw new Error(`Expected status 401 for invalid token delete, but got ${tokenDeleteRes.status}`);
  }
  console.log("✅ Token-unauthorized Delete rejected successfully.");

  // 6. Test Bulk Parallel Photo Uploads (POST)
  console.log("\n🧪 Test 6: Bulk Parallel Photo Uploads (POST) - 10 uploads");
  const uploadStartTime = Date.now();
  const uploadPromises = Array.from({ length: 10 }).map((_, index) => {
    return fetch(`${BASE_URL}/api/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: `bulk_test_phone_${index}_photo.jpg`,
        image: MOCK_IMAGE
      })
    }).then(async res => {
      if (res.status !== 200) {
        const text = await res.text();
        throw new Error(`Upload ${index} failed: ${text}`);
      }
      return res.json();
    });
  });

  const bulkUploadResults = await Promise.all(uploadPromises);
  const uploadDuration = Date.now() - uploadStartTime;
  console.log(`✅ Successfully uploaded 10 files concurrently in ${uploadDuration}ms (~${Math.round(10 / (uploadDuration / 1000))} uploads/sec)`);
  
  // Verify all have urls and signatures
  bulkUploadResults.forEach((res, index) => {
    if (!res.success || !res.photo_url || !res.signature) {
      throw new Error(`Bulk upload ${index} response missing critical fields!`);
    }
  });

  // 7. Test Bulk Parallel Photo Deletions (DELETE)
  console.log("\n🧪 Test 7: Bulk Parallel Photo Deletions (DELETE) - 10 deletions");
  const deleteStartTime = Date.now();
  const deletePromises = bulkUploadResults.map((uploadRes, index) => {
    const fn = uploadRes.photo_url.split('/').pop();
    return fetch(
      `${BASE_URL}/api/upload?filename=${encodeURIComponent(fn)}&signature=${uploadRes.signature}`, 
      { method: 'DELETE' }
    ).then(async res => {
      if (res.status !== 200) {
        const text = await res.text();
        throw new Error(`Deletion ${index} failed: ${text}`);
      }
      return res.json();
    });
  });

  await Promise.all(deletePromises);
  const deleteDuration = Date.now() - deleteStartTime;
  console.log(`✅ Successfully deleted 10 files concurrently in ${deleteDuration}ms (~${Math.round(10 / (deleteDuration / 1000))} deletions/sec)`);
  // 8. Test Admin User Creation (POST /api/create-admin)
  console.log("\n🧪 Test 8: Admin User Creation (POST /api/create-admin) - Security & Mock Verification");
  
  // A. Unauthorized (no token)
  const noTokenRes = await fetch(`${BASE_URL}/api/create-admin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: "test_new_admin@yep.com", password: "password123" })
  });
  console.log(`Status code (expected 401): ${noTokenRes.status}`);
  if (noTokenRes.status !== 401) {
    throw new Error(`Expected status 401 for unauthorized admin creation, got ${noTokenRes.status}`);
  }
  
  // B. Authorized mock registration
  const mockCreateRes = await fetch(`${BASE_URL}/api/create-admin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer mock_admin_token'
    },
    body: JSON.stringify({ email: "test_new_admin@yep.com", password: "password123" })
  });
  console.log(`Status code (expected 200): ${mockCreateRes.status}`);
  if (mockCreateRes.status !== 200) {
    const errText = await mockCreateRes.text();
    throw new Error(`Expected status 200 for mock admin creation, got ${mockCreateRes.status}: ${errText}`);
  }
  
  const createResult = await mockCreateRes.json();
  console.log("Create Admin Response:", createResult);
  if (!createResult.success || !createResult.user || createResult.user.email !== "test_new_admin@yep.com") {
    throw new Error("Invalid admin creation response structure or email mismatch!");
  }
  
  // C. Test Validation - Invalid Email format (expected 400)
  console.log("\n🧪 Test 8C: Input validation - Invalid Email format");
  const invalidEmailRes = await fetch(`${BASE_URL}/api/create-admin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer mock_admin_token'
    },
    body: JSON.stringify({ email: "invalid-email-format", password: "password123" })
  });
  console.log(`Status code (expected 400): ${invalidEmailRes.status}`);
  if (invalidEmailRes.status !== 400) {
    throw new Error(`Expected status 400 for invalid email, got ${invalidEmailRes.status}`);
  }
  const invalidEmailText = await invalidEmailRes.text();
  console.log("Response text (expected invalid format error):", invalidEmailText);

  // D. Test Validation - Weak/Short Password (expected 400)
  console.log("\n🧪 Test 8D: Input validation - Weak/Short Password");
  const weakPasswordRes = await fetch(`${BASE_URL}/api/create-admin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer mock_admin_token'
    },
    body: JSON.stringify({ email: "valid@yep.com", password: "123" })
  });
  console.log(`Status code (expected 400): ${weakPasswordRes.status}`);
  if (weakPasswordRes.status !== 400) {
    throw new Error(`Expected status 400 for weak password, got ${weakPasswordRes.status}`);
  }
  const weakPasswordText = await weakPasswordRes.text();
  console.log("Response text (expected password length error):", weakPasswordText);

  console.log("✅ Admin User Creation API passed successfully (zero residue).");

  console.log("\n🎉 ALL BACKEND API TESTS PASSED SUCCESSFULLY! 🎉\n");

}


async function main() {
  console.log("🚀 Launching local Wrangler Dev Server...");
  
  const devServer = spawn('npx', ['wrangler', 'pages', 'dev', '.', '--port', String(PORT), '--compatibility-date=2026-06-11', '--r2', 'BUCKET'], {
    stdio: 'pipe',
    shell: true
  });

  let devOutput = "";
  devServer.stdout.on('data', (data) => {
    devOutput += data.toString();
  });
  devServer.stderr.on('data', (data) => {
    devOutput += data.toString();
  });

  let hasError = false;

  try {
    // Wait for server to start accepting requests
    await waitForServer(BASE_URL);
    
    // Run all tests
    await runTests();
  } catch (err) {
    console.error("\n❌ TEST FAILED:", err.message);
    console.log("\n--- Wrangler Dev Server Output ---");
    console.log(devOutput);
    console.log("----------------------------------");
    hasError = true;
  } finally {
    console.log("🔌 Stopping Wrangler Dev Server...");
    devServer.kill();
    process.exit(hasError ? 1 : 0);
  }
}

main();
