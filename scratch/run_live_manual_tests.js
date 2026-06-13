const crypto = require('crypto');

const SUPABASE_URL = 'https://hqaimprjdejeklrtntfz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxYWltcHJqZGVqZWtscnRudGZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExODk5MzksImV4cCI6MjA5Njc2NTkzOX0.HgeoS1c8B0oK67PnXzr3q_nsRDLaBAB1XGRg1O0rk1I';

async function sha256(message) {
  const hash = crypto.createHash('sha256');
  hash.update(message);
  return hash.digest('hex');
}

async function runLiveTests() {
  console.log("🏁 Starting programmatic execution of Manual Test Cases 1.1, 1.2, and 1.3...");
  console.log(`📡 Targeting Supabase URL: ${SUPABASE_URL}`);
  
  const testPhone = "9448610199";
  const testAadhaar = "999999999999";
  const testAadhaarHash = await sha256(testAadhaar);
  const secureAadhaarPayload = `${testAadhaarHash}:9999`;

  const memberData = {
    name: "Live Test Member",
    phone: testPhone,
    aadhaar: secureAadhaarPayload,
    qualification: "Undergraduate",
    state: "Karnataka",
    district: "Bengaluru Urban / ಬೆಂಗಳೂರು ನಗರ",
    taluk: "Bengaluru South / ಬೆಂಗಳೂರು ದಕ್ಷಿಣ",
    village: "Test Village",
    photo_url: "https://pub-3525e3b961a54cb992d074fd3b03afb9.r2.dev/test_photo.jpg",
    approved: false
  };

  let test1Passed = false;
  let test2Passed = false;
  let test3Passed = false;

  // --- TEST case 1.1: Register Member (expect success) ---
  console.log("\n🧪 Test Case 1.1: Register new member...");
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

  // --- CLEANUP: Delete the test member ---
  console.log("\n🧹 Cleaning up test registrations from live database (zero residues)...");
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/members?phone=eq.${testPhone}`, {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });

    if (res.ok) {
      console.log("✅ Cleanup successful! Test member deleted.");
    } else {
      const errText = await res.text();
      console.error(`❌ Cleanup failed (Status ${res.status}):`, errText);
    }
  } catch (err) {
    console.error("❌ Cleanup Exception:", err.message);
  }

  console.log("\n📋 --- Live Database Verification Summary ---");
  console.log(`Test 1.1 (Register new member): ${test1Passed ? "PASS" : "FAIL"}`);
  console.log(`Test 1.2 (Reject duplicate phone): ${test2Passed ? "PASS" : "FAIL"}`);
  console.log(`Test 1.3 (Reject duplicate Aadhaar): ${test3Passed ? "PASS" : "FAIL"}`);
  
  if (test1Passed && test2Passed && test3Passed) {
    console.log("\n🎉 ALL LIVE DATABASE CONSTRAINT TESTS PASSED SUCCESSFULLY! 🎉\n");
  } else {
    console.error("\n❌ SOME LIVE DATABASE CONSTRAINT TESTS FAILED!\n");
  }
}

runLiveTests();
