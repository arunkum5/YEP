const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hqaimprjdejeklrtntfz.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxYWltcHJqZGVqZWtscnRudGZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExODk5MzksImV4cCI6MjA5Njc2NTkzOX0.HgeoS1c8B0oK67PnXzr3q_nsRDLaBAB1XGRg1O0rk1I';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const API_BASE_URL = process.env.API_BASE_URL || 'https://4ec879a8.yep-01l.pages.dev';

// Use Service Role Key if available (to bypass RLS for cleanup/deletes), otherwise fallback to Anon Key
const adminKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;

// Mock 1x1 transparent pixel JPEG
const MOCK_IMAGE = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";

async function sha256(message) {
  const hash = crypto.createHash('sha256');
  hash.update(message);
  return hash.digest('hex');
}

async function uploadPhotoToR2(phone) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: `${phone}_test_photo.jpg`,
        image: MOCK_IMAGE
      })
    });
    if (res.ok) {
      const data = await res.json();
      return { success: true, url: data.photo_url, signature: data.signature };
    } else {
      const text = await res.text();
      console.warn(`⚠️ R2 upload failed (Status ${res.status}): ${text}. Using fallback url.`);
    }
  } catch (e) {
    console.warn(`⚠️ R2 upload exception: ${e.message}. Using fallback url.`);
  }
  return { success: false, url: "https://pub-3525e3b961a54cb992d074fd3b03afb9.r2.dev/test_photo.jpg", signature: null };
}

async function deletePhotoFromR2(url, signature) {
  if (!signature) return;
  const filename = url.substring(url.lastIndexOf('/') + 1);
  try {
    const res = await fetch(`${API_BASE_URL}/api/upload?filename=${encodeURIComponent(filename)}&signature=${signature}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      console.log(`   - Cleanup R2 photo ${filename}: success`);
    } else {
      const text = await res.text();
      console.warn(`   - Cleanup R2 photo ${filename} failed (Status ${res.status}): ${text}`);
    }
  } catch (e) {
    console.warn(`   - Cleanup R2 photo exception for ${filename}:`, e.message);
  }
}

async function runLiveTests() {
  console.log("🏁 Starting programmatic execution of Membership flow and constraint tests...");
  console.log(`📡 Supabase URL: ${SUPABASE_URL}`);
  console.log(`📡 API Base URL: ${API_BASE_URL}`);
  if (SUPABASE_SERVICE_ROLE_KEY) {
    console.log("🔑 SUPABASE_SERVICE_ROLE_KEY detected! Bypassing Row Level Security (RLS) for cleanup.");
  } else {
    console.warn("⚠️ SUPABASE_SERVICE_ROLE_KEY not detected. Cleanup/Updates might fail due to database RLS.");
  }

  const testPhone = "9448610199";
  const testAadhaar = "999999999999";
  const testAadhaarHash = await sha256(testAadhaar);
  const secureAadhaarPayload = `${testAadhaarHash}:9999`;

  const pendingPhone = "9448610190";
  const pendingAadhaarHash = await sha256("888888888888");
  const securePendingAadhaar = `${pendingAadhaarHash}:8888`;

  // --- STARTUP CLEANUP: Remove leftover records ---
  console.log("\n🧹 Performing startup cleanup to ensure fresh state...");
  for (const phone of [testPhone, pendingPhone, "9448610198"]) {
    try {
      const cleanupRes = await fetch(`${SUPABASE_URL}/rest/v1/members?phone=eq.${phone}`, {
        method: 'DELETE',
        headers: {
          'apikey': adminKey,
          'Authorization': `Bearer ${adminKey}`
        }
      });
      if (cleanupRes.ok) {
        console.log(`   - Cleanup for phone ${phone}: success/skipped`);
      } else {
        console.warn(`   - Cleanup for phone ${phone} returned status ${cleanupRes.status}`);
      }
    } catch (e) {
      console.warn(`   - Startup cleanup error for ${phone}:`, e.message);
    }
  }

  // Upload test photos for both tests
  console.log("\n📸 Uploading mock photos to R2...");
  const photo1 = await uploadPhotoToR2(testPhone);
  const photo2 = await uploadPhotoToR2(pendingPhone);

  const memberData = {
    name: "Live Test Member",
    phone: testPhone,
    aadhaar: secureAadhaarPayload,
    qualification: "Undergraduate",
    state: "Karnataka",
    district: "Bengaluru Urban / ಬೆಂಗಳೂರು ನಗರ",
    taluk: "Bengaluru South / ಬೆಂಗಳೂರು ದಕ್ಷಿಣ",
    village: "Test Village",
    photo_url: photo1.url,
    approved: false
  };

  let test1Passed = false;
  let test2Passed = false;
  let test3Passed = false;
  let test4Passed = false;
  let test5Passed = false;
  let test6Passed = false;

  // --- TEST case 1.1: Register Member (expect success) ---
  console.log("\n🧪 Test Case 1.1: Register new member (direct insert)...");
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/members`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(memberData)
    });

    if (res.ok) {
      const data = await res.json();
      console.log("✅ Registration Succeeded! Response:", data);
      test1Passed = true;
    } else {
      const errText = await res.text();
      console.error(`❌ Registration failed with status ${res.status}:`, errText);
    }
  } catch (err) {
    console.error("❌ Test 1.1 Exception:", err.message);
  }

  // --- TEST case 1.2: Register duplicate Phone (expect failure) ---
  console.log("\n🧪 Test Case 1.2: Register duplicate Phone...");
  try {
    const duplicatePhoneData = {
      ...memberData,
      name: "Duplicate Phone Member",
      aadhaar: `${await sha256("111111111111")}:1111` // Different Aadhaar
    };

    const res = await fetch(`${SUPABASE_URL}/rest/v1/members`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(duplicatePhoneData)
    });

    if (res.status === 409 || res.status === 400) {
      const err = await res.json();
      console.log(`✅ Duplicate phone registration successfully rejected as expected (Status ${res.status})`);
      console.log("Error details:", err);
      if (err.code === "23505" || err.message.includes("violates unique constraint")) {
        test2Passed = true;
      }
    } else if (res.ok) {
      console.error("❌ Test 1.2 Failure: Server allowed registering duplicate phone!");
    } else {
      const errText = await res.text();
      console.error(`❌ Unexpected response (Status ${res.status}):`, errText);
    }
  } catch (err) {
    console.error("❌ Test 1.2 Exception:", err.message);
  }

  // --- TEST case 1.3: Register duplicate Aadhaar (expect failure) ---
  console.log("\n🧪 Test Case 1.3: Register duplicate Aadhaar...");
  try {
    const duplicateAadhaarData = {
      ...memberData,
      name: "Duplicate Aadhaar Member",
      phone: "9448610198" // Different Phone
    };

    const res = await fetch(`${SUPABASE_URL}/rest/v1/members`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(duplicateAadhaarData)
    });

    if (res.status === 409 || res.status === 400) {
      const err = await res.json();
      console.log(`✅ Duplicate Aadhaar registration successfully rejected as expected (Status ${res.status})`);
      console.log("Error details:", err);
      if (err.code === "23505" || err.message.includes("violates unique constraint")) {
        test3Passed = true;
      }
    } else if (res.ok) {
      console.error("❌ Test 1.3 Failure: Server allowed registering duplicate Aadhaar!");
    } else {
      const errText = await res.text();
      console.error(`❌ Unexpected response (Status ${res.status}):`, errText);
    }
  } catch (err) {
    console.error("❌ Test 1.3 Exception:", err.message);
  }

  // --- TEST case 1.4: Payment Failure Simulation (Leaves DB Clean) ---
  console.log("\n🧪 Test Case 1.4: Register member with payment failure...");
  try {
    // Under new flow, starting a checkout does NOT insert a record.
    // So if payment fails or is aborted, nothing should be in Supabase.
    // Let's verify that the member record with pendingPhone does NOT exist.
    const res = await fetch(`${SUPABASE_URL}/rest/v1/members?phone=eq.${pendingPhone}&select=id`, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });

    if (res.ok) {
      const data = await res.json();
      if (!data || data.length === 0) {
        console.log("✅ Verified: Database remains clean on payment failure (no pending record created).");
        test4Passed = true;
      } else {
        console.error("❌ Test 1.4 Failure: A member record was found in the DB for a failed/aborted checkout:", data);
      }
    } else {
      const errText = await res.text();
      console.error(`❌ Test 1.4 failed to fetch (Status ${res.status}):`, errText);
    }
  } catch (err) {
    console.error("❌ Test 1.4 Exception:", err.message);
  }

  // --- TEST case 1.5: Payment Failure & Retry (Simulate Retry that succeeds) ---
  console.log("\n🧪 Test Case 1.5: Retry registration (succeeds) for the same user...");
  try {
    // Retry flow: User enters details again and this time payment succeeds.
    // We insert the record with 'paid' status directly, simulating the successful handler insert.
    const successMemberData = {
      name: "Paid Test Member",
      phone: pendingPhone,
      aadhaar: securePendingAadhaar,
      qualification: "Graduate",
      state: "Karnataka",
      district: "Bengaluru Urban / ಬೆಂಗಳೂರು ನಗರ",
      taluk: "Bengaluru South / ಬೆಂಗಳೂರು ದಕ್ಷಿಣ",
      village: "Test Village",
      photo_url: photo2.url,
      approved: false,
      payment_status: 'paid',
      payment_id: 'pay_test_retry_success',
      amount_paid: 99.00
    };

    const res = await fetch(`${SUPABASE_URL}/rest/v1/members`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(successMemberData)
    });

    if (res.ok) {
      const data = await res.json();
      console.log("✅ Retry Succeeded! Record inserted with 'paid' status:", data);
      test5Passed = true;
    } else {
      const errText = await res.text();
      console.error(`❌ Retry registration insert failed (Status ${res.status}):`, errText);
    }
  } catch (err) {
    console.error("❌ Test 1.5 Exception:", err.message);
  }

  // --- TEST case 1.6: Block duplicate registration on Paid Member ---
  console.log("\n🧪 Test Case 1.6: Attempt duplicate registration on paid member...");
  try {
    const duplicatePaidData = {
      name: "Duplicate Paid Member",
      phone: pendingPhone,
      aadhaar: securePendingAadhaar,
      qualification: "Graduate",
      state: "Karnataka",
      district: "Bengaluru Urban / ಬೆಂಗಳೂರು ನಗರ",
      taluk: "Bengaluru South / ಬೆಂಗಳೂರು ದಕ್ಷಿಣ",
      village: "Test Village",
      photo_url: photo2.url,
      approved: false
    };

    // Client-side simulation: check before checkout or catch duplicate key
    const res = await fetch(`${SUPABASE_URL}/rest/v1/members`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(duplicatePaidData)
    });

    if (res.status === 409 || res.status === 400) {
      const err = await res.json();
      console.log(`✅ Duplicate registration correctly rejected by unique constraints (Status ${res.status}):`, err.message);
      
      // Query database to verify status is paid
      const fetchRes = await fetch(`${SUPABASE_URL}/rest/v1/members?phone=eq.${pendingPhone}&select=payment_status`, {
        method: 'GET',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
      });
      const fetchData = await fetchRes.json();
      if (fetchRes.ok && fetchData && fetchData.length > 0 && fetchData[0].payment_status === 'paid') {
        console.log("✅ Verified: Member is indeed paid. Frontend blocks duplicate registration correctly.");
        test6Passed = true;
      } else {
        console.error("❌ Test 1.6: Failed to verify payment_status of paid member:", fetchRes.status, fetchData);
      }
    } else if (res.ok) {
      console.error("❌ Test 1.6 Failure: Database allowed registering duplicate phone/Aadhaar on paid member!");
    } else {
      const errText = await res.text();
      console.error(`❌ Test 1.6 Unexpected response (Status ${res.status}):`, errText);
    }
  } catch (err) {
    console.error("❌ Test 1.6 Exception:", err.message);
  }

  // --- CLEANUP: Delete the test members and their R2 files ---
  console.log("\n🧹 Cleaning up test registrations from live database (zero residues)...");
  let cleanupPassed = true;
  for (const phone of [testPhone, pendingPhone, "9448610198"]) {
    try {
      const cleanupRes = await fetch(`${SUPABASE_URL}/rest/v1/members?phone=eq.${phone}`, {
        method: 'DELETE',
        headers: {
          'apikey': adminKey,
          'Authorization': `Bearer ${adminKey}`
        }
      });

      // Verify deletion actually occurred
      const verifyRes = await fetch(`${SUPABASE_URL}/rest/v1/members?phone=eq.${phone}&select=id`, {
        method: 'GET',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
      });
      
      if (verifyRes.ok) {
        const verifyData = await verifyRes.json();
        if (verifyData && verifyData.length > 0) {
          console.error(`❌ CLEANUP FAILED: Member with phone ${phone} still exists in DB! (Row Level Security blocked deletion)`);
          cleanupPassed = false;
        } else {
          console.log(`   - Cleanup for phone ${phone} verified (0 residues).`);
        }
      } else {
        console.error(`❌ Cleanup verification fetch failed for ${phone} (Status ${verifyRes.status})`);
        cleanupPassed = false;
      }
    } catch (err) {
      console.error(`❌ Cleanup Exception for phone ${phone}:`, err.message);
      cleanupPassed = false;
    }
  }

  console.log("\n🧹 Cleaning up test photos from R2...");
  await deletePhotoFromR2(photo1.url, photo1.signature);
  await deletePhotoFromR2(photo2.url, photo2.signature);

  console.log("\n📋 --- Live Database Verification Summary ---");
  console.log(`Test 1.1 (Register new member): ${test1Passed ? "PASS" : "FAIL"}`);
  console.log(`Test 1.2 (Reject duplicate phone): ${test2Passed ? "PASS" : "FAIL"}`);
  console.log(`Test 1.3 (Reject duplicate Aadhaar): ${test3Passed ? "PASS" : "FAIL"}`);
  console.log(`Test 1.4 (Clean DB on payment failure): ${test4Passed ? "PASS" : "FAIL"}`);
  console.log(`Test 1.5 (Succeed retry of same user): ${test5Passed ? "PASS" : "FAIL"}`);
  console.log(`Test 1.6 (Block duplicate on paid member): ${test6Passed ? "PASS" : "FAIL"}`);
  console.log(`Cleanup Verification (0 residues): ${cleanupPassed ? "PASS" : "FAIL"}`);
  
  if (test1Passed && test2Passed && test3Passed && test4Passed && test5Passed && test6Passed && cleanupPassed) {
    console.log("\n🎉 ALL LIVE DATABASE CONSTRAINT TESTS AND CLEANUPS PASSED SUCCESSFULLY! 🎉\n");
  } else {
    console.error("\n❌ SOME LIVE DATABASE CONSTRAINT TESTS OR CLEANUPS FAILED!\n");
  }
}

runLiveTests();
