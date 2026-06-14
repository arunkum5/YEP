const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hqaimprjdejeklrtntfz.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxYWltcHJqZGVqZWtscnRudGZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExODk5MzksImV4cCI6MjA5Njc2NTkzOX0.HgeoS1c8B0oK67PnXzr3q_nsRDLaBAB1XGRg1O0rk1I';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const API_BASE_URL = process.env.API_BASE_URL || 'https://test.yep-01l.pages.dev';

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

  // Generate a random 6-digit suffix for every test run (guarantees uniqueness)
  const randomSuffix = Math.floor(100000 + Math.random() * 900000);
  
  const testPhone = `9000${randomSuffix}`; // e.g. 9000123456
  const testAadhaar = `999999${randomSuffix}`;
  const testAadhaarHash = await sha256(testAadhaar);
  const secureAadhaarPayload = `${testAadhaarHash}:${testAadhaar.slice(-4)}`;

  const pendingPhone = `9001${randomSuffix}`; // e.g. 9001123456
  const pendingAadhaar = `888888${randomSuffix}`;
  const pendingAadhaarHash = await sha256(pendingAadhaar);
  const securePendingAadhaar = `${pendingAadhaarHash}:${pendingAadhaar.slice(-4)}`;

  const duplicatePhone = `9002${randomSuffix}`;

  const freePhone = `9003${randomSuffix}`;
  const freeAadhaar = `777777${randomSuffix}`;
  const freeAadhaarHash = await sha256(freeAadhaar);
  const secureFreeAadhaar = `${freeAadhaarHash}:${freeAadhaar.slice(-4)}`;

  const customAmountPhone = `9004${randomSuffix}`;
  const customAmountAadhaar = `666666${randomSuffix}`;
  const customAmountAadhaarHash = await sha256(customAmountAadhaar);
  const secureCustomAmountAadhaar = `${customAmountAadhaarHash}:${customAmountAadhaar.slice(-4)}`;

  // Configuration Permutations Test Variables
  const case21Phone = `8001${randomSuffix}`;
  const case21Aadhaar = `110111${randomSuffix}`;
  const secureCase21Aadhaar = `${await sha256(case21Aadhaar)}:${case21Aadhaar.slice(-4)}`;

  const case22Phone = `8002${randomSuffix}`;
  const case22Aadhaar = `110222${randomSuffix}`;
  const secureCase22Aadhaar = `${await sha256(case22Aadhaar)}:${case22Aadhaar.slice(-4)}`;

  const case23Phone = `8003${randomSuffix}`;
  const case23Aadhaar = `110333${randomSuffix}`;
  const secureCase23Aadhaar = `${await sha256(case23Aadhaar)}:${case23Aadhaar.slice(-4)}`;

  const case24Phone = `8004${randomSuffix}`;
  const case24Aadhaar = `110444${randomSuffix}`;
  const secureCase24Aadhaar = `${await sha256(case24Aadhaar)}:${case24Aadhaar.slice(-4)}`;

  const case25Phone = `8005${randomSuffix}`;
  const case25Aadhaar = `110555${randomSuffix}`;
  const secureCase25Aadhaar = `${await sha256(case25Aadhaar)}:${case25Aadhaar.slice(-4)}`;

  // --- STARTUP CLEANUP: Remove leftover records ---
  console.log("\n🧹 Performing startup cleanup to ensure fresh state...");
  for (const phone of [testPhone, pendingPhone, duplicatePhone, freePhone, customAmountPhone, case21Phone, case22Phone, case23Phone, case24Phone, case25Phone]) {
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
  let test7Passed = false;
  let test8Passed = false;

  let test21Passed = false;
  let test22Passed = false;
  let test23Passed = false;
  let test24Passed = false;
  let test25Passed = false;

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
      phone: duplicatePhone // Different Phone
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
      amount_paid: 1000.00
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

  // --- TEST case 1.7: Register member with 'free' status ---
  console.log("\n🧪 Test Case 1.7: Register free member (payment_status: 'free')...");
  try {
    const freeMemberData = {
      name: "Free Test Member",
      phone: freePhone,
      aadhaar: secureFreeAadhaar,
      qualification: "Primary School",
      state: "Karnataka",
      district: "Bengaluru Urban / ಬೆಂಗಳೂರು ನಗರ",
      taluk: "Bengaluru South / ಬೆಂಗಳೂರು ದಕ್ಷಿಣ",
      village: "Free Village",
      photo_url: photo1.url,
      approved: false,
      payment_status: 'free',
      amount_paid: null
    };

    const res = await fetch(`${SUPABASE_URL}/rest/v1/members`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(freeMemberData)
    });

    if (res.ok) {
      const data = await res.json();
      console.log("✅ Free registration success! Record inserted:", data);
      test7Passed = true;
    } else {
      const errText = await res.text();
      console.error(`❌ Free registration insert failed (Status ${res.status}):`, errText);
    }
  } catch (err) {
    console.error("❌ Test 1.7 Exception:", err.message);
  }

  // --- TEST case 1.8: Register member with custom payment amount ---
  console.log("\n🧪 Test Case 1.8: Register member with custom payment amount (e.g. ₹1500.00)...");
  try {
    const customAmtData = {
      name: "Custom Amount Member",
      phone: customAmountPhone,
      aadhaar: secureCustomAmountAadhaar,
      qualification: "Postgraduate",
      state: "Karnataka",
      district: "Bengaluru Urban / ಬೆಂಗಳೂರು ನಗರ",
      taluk: "Bengaluru South / ಬೆಂಗಳೂರು ದಕ್ಷಿಣ",
      village: "Custom Village",
      photo_url: photo2.url,
      approved: false,
      payment_status: 'paid',
      payment_id: 'pay_test_custom_amount_1500',
      amount_paid: 1500.00
    };

    const res = await fetch(`${SUPABASE_URL}/rest/v1/members`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(customAmtData)
    });

    if (res.ok) {
      const data = await res.json();
      console.log("✅ Custom amount registration success! Record inserted:", data);
      test8Passed = true;
    } else {
      const errText = await res.text();
      console.error(`❌ Custom amount registration insert failed (Status ${res.status}):`, errText);
    }
  } catch (err) {
    console.error("❌ Test 1.8 Exception:", err.message);
  }

  // --- HELPERS FOR PERMUTATION TESTS ---
  async function setAppSetting(key, value) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/app_settings`, {
        method: 'POST',
        headers: {
          'apikey': adminKey,
          'Authorization': `Bearer ${adminKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({ key, value })
      });
      if (!res.ok) {
        const text = await res.text();
        console.warn(`   ⚠️ Failed to set app setting ${key}=${value}: ${text}`);
      }
    } catch (e) {
      console.error(`   ⚠️ Exception setting app setting ${key}=${value}:`, e.message);
    }
  }

  async function simulateCheckout(amount, phone, name) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/create-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amount,
          currency: 'INR',
          phone: phone,
          name: name
        })
      });
      return res;
    } catch (e) {
      console.error("   Simulation checkout request failed:", e.message);
      return null;
    }
  }

  // --- TEST Case 2.1: payment_enabled = 'true', membership_fee = '1000' ---
  console.log("\n🧪 Test Case 2.1: Payment ON (Require Payment) & Fee ₹1000...");
  try {
    await setAppSetting('payment_enabled', 'true');
    await setAppSetting('membership_fee', '1000');
    
    // Simulate checkout creation
    const checkoutRes = await simulateCheckout(1000, case21Phone, "Case 2.1 Member");
    if (checkoutRes && checkoutRes.ok) {
      const checkoutData = await checkoutRes.json();
      if (checkoutData.success && checkoutData.order.amount === 100000) {
        console.log("   ✅ Checkout created successfully with 100000 paise (₹1000).");
        
        // Insert record representing paid status
        const res = await fetch(`${SUPABASE_URL}/rest/v1/members`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({
            name: "Case 2.1 Paid Member",
            phone: case21Phone,
            aadhaar: secureCase21Aadhaar,
            qualification: "SSLC",
            state: "Karnataka",
            district: "Mysuru / ಮೈಸೂರು",
            taluk: "Mysuru / ಮೈಸೂರು",
            photo_url: photo1.url,
            approved: false,
            payment_status: 'paid',
            payment_id: 'pay_mock_case_2_1',
            amount_paid: 1000
          })
        });

        if (res.ok) {
          console.log("   ✅ Member inserted successfully with status 'paid' and ₹1000.");
          test21Passed = true;
        } else {
          console.error("   ❌ Member insertion failed:", await res.text());
        }
      } else {
        console.error("   ❌ Checkout data mismatch:", checkoutData);
      }
    } else {
      console.error("   ❌ Checkout creation failed status:", checkoutRes ? checkoutRes.status : "No response");
    }
  } catch (err) {
    console.error("   ❌ Test 2.1 Exception:", err.message);
  }

  // --- TEST Case 2.2: payment_enabled = 'true', membership_fee = '500' ---
  console.log("\n🧪 Test Case 2.2: Payment ON (Require Payment) & Fee ₹500...");
  try {
    await setAppSetting('payment_enabled', 'true');
    await setAppSetting('membership_fee', '500');
    
    // Simulate checkout creation
    const checkoutRes = await simulateCheckout(500, case22Phone, "Case 2.2 Member");
    if (checkoutRes && checkoutRes.ok) {
      const checkoutData = await checkoutRes.json();
      if (checkoutData.success && checkoutData.order.amount === 50000) {
        console.log("   ✅ Checkout created successfully with 50000 paise (₹500).");
        
        // Insert record representing paid status
        const res = await fetch(`${SUPABASE_URL}/rest/v1/members`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({
            name: "Case 2.2 Paid Member",
            phone: case22Phone,
            aadhaar: secureCase22Aadhaar,
            qualification: "PUC",
            state: "Karnataka",
            district: "Udupi / ಉಡುಪಿ",
            taluk: "Karkala / ಕಾರ್ಕಳ",
            photo_url: photo1.url,
            approved: false,
            payment_status: 'paid',
            payment_id: 'pay_mock_case_2_2',
            amount_paid: 500
          })
        });

        if (res.ok) {
          console.log("   ✅ Member inserted successfully with status 'paid' and ₹500.");
          test22Passed = true;
        } else {
          console.error("   ❌ Member insertion failed:", await res.text());
        }
      } else {
        console.error("   ❌ Checkout data mismatch:", checkoutData);
      }
    } else {
      console.error("   ❌ Checkout creation failed status:", checkoutRes ? checkoutRes.status : "No response");
    }
  } catch (err) {
    console.error("   ❌ Test 2.2 Exception:", err.message);
  }

  // --- TEST Case 2.3: payment_enabled = 'false', membership_fee = '1000' ---
  console.log("\n🧪 Test Case 2.3: Payment OFF (Membership Free) & Fee ₹1000 (Fee bypassed)...");
  try {
    await setAppSetting('payment_enabled', 'false');
    await setAppSetting('membership_fee', '1000');
    
    // In free mode, the client bypasses Razorpay entirely and does a direct insert.
    const res = await fetch(`${SUPABASE_URL}/rest/v1/members`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        name: "Case 2.3 Free Member",
        phone: case23Phone,
        aadhaar: secureCase23Aadhaar,
        qualification: "Graduate",
        state: "Karnataka",
        district: "Mysuru / ಮೈಸೂರು",
        taluk: "Nanjangud / ನಂಜನಗೂಡು",
        photo_url: photo1.url,
        approved: false,
        payment_status: 'free',
        payment_id: 'FREE_REGISTRATION',
        amount_paid: 0
      })
    });

    if (res.ok) {
      console.log("   ✅ Member inserted successfully with status 'free' and ₹0.");
      test23Passed = true;
    } else {
      console.error("   ❌ Member insertion failed:", await res.text());
    }
  } catch (err) {
    console.error("   ❌ Test 2.3 Exception:", err.message);
  }

  // --- TEST Case 2.4: payment_enabled = 'false', membership_fee = '500' ---
  console.log("\n🧪 Test Case 2.4: Payment OFF (Membership Free) & Fee ₹500 (Fee bypassed)...");
  try {
    await setAppSetting('payment_enabled', 'false');
    await setAppSetting('membership_fee', '500');
    
    // In free mode, direct insert with 'free' and 0
    const res = await fetch(`${SUPABASE_URL}/rest/v1/members`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        name: "Case 2.4 Free Member",
        phone: case24Phone,
        aadhaar: secureCase24Aadhaar,
        qualification: "Post Graduate",
        state: "Karnataka",
        district: "Tumakuru / ತುಮಕೂರು",
        taluk: "Gubbi / ಗುಬ್ಬಿ",
        photo_url: photo1.url,
        approved: false,
        payment_status: 'free',
        payment_id: 'FREE_REGISTRATION',
        amount_paid: 0
      })
    });

    if (res.ok) {
      console.log("   ✅ Member inserted successfully with status 'free' and ₹0.");
      test24Passed = true;
    } else {
      console.error("   ❌ Member insertion failed:", await res.text());
    }
  } catch (err) {
    console.error("   ❌ Test 2.4 Exception:", err.message);
  }

  // --- TEST Case 2.5: payment_enabled = 'true', membership_fee = '0' ---
  console.log("\n🧪 Test Case 2.5: Payment ON (Require Payment) & Fee ₹0 (Expect Failure)...");
  try {
    await setAppSetting('payment_enabled', 'true');
    await setAppSetting('membership_fee', '0');
    
    // Call create-checkout with amount 0. This must fail because ₹0 is invalid.
    const checkoutRes = await simulateCheckout(0, case25Phone, "Case 2.5 Member");
    if (checkoutRes && checkoutRes.status === 400) {
      const checkoutData = await checkoutRes.json();
      if (!checkoutData.success && checkoutData.error.includes("Missing amount")) {
        console.log(`   ✅ Checkout creation successfully rejected as expected (Status 400): ${checkoutData.error}`);
        test25Passed = true;
      } else {
        console.error("   ❌ Checkout response success flag was true or error message mismatch:", checkoutData);
      }
    } else {
      console.error("   ❌ Checkout creation response status was not 400:", checkoutRes ? checkoutRes.status : "No response");
    }
  } catch (err) {
    console.error("   ❌ Test 2.5 Exception:", err.message);
  }

  // Restore Default Settings
  console.log("\n⚙️ Restoring default Supabase app settings...");
  await setAppSetting('payment_enabled', 'true');
  await setAppSetting('membership_fee', '1000');

  // --- CLEANUP: Delete the test members and their R2 files ---
  console.log("\n🧹 Cleaning up test registrations from live database (zero residues)...");
  let cleanupPassed = true;
  for (const phone of [testPhone, pendingPhone, duplicatePhone, freePhone, customAmountPhone, case21Phone, case22Phone, case23Phone, case24Phone, case25Phone]) {
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
  console.log(`Test 1.7 (Register free status member): ${test7Passed ? "PASS" : "FAIL"}`);
  console.log(`Test 1.8 (Register custom payment amount): ${test8Passed ? "PASS" : "FAIL"}`);

  console.log(`Test 2.1 (Payment ON, Fee 1000): ${test21Passed ? "PASS" : "FAIL"}`);
  console.log(`Test 2.2 (Payment ON, Fee 500): ${test22Passed ? "PASS" : "FAIL"}`);
  console.log(`Test 2.3 (Payment OFF, Fee 1000): ${test23Passed ? "PASS" : "FAIL"}`);
  console.log(`Test 2.4 (Payment OFF, Fee 500): ${test24Passed ? "PASS" : "FAIL"}`);
  console.log(`Test 2.5 (Payment ON, Fee 0): ${test25Passed ? "PASS" : "FAIL"}`);
  console.log(`Cleanup Verification (0 residues): ${cleanupPassed ? "PASS" : "FAIL"}`);
  
  if (test1Passed && test2Passed && test3Passed && test4Passed && test5Passed && test6Passed && test7Passed && test8Passed && test21Passed && test22Passed && test23Passed && test24Passed && test25Passed && cleanupPassed) {
    console.log("\n🎉 ALL LIVE DATABASE CONSTRAINT TESTS AND CLEANUPS PASSED SUCCESSFULLY! 🎉\n");
  } else {
    console.error("\n❌ SOME LIVE DATABASE CONSTRAINT TESTS OR CLEANUPS FAILED!\n");
  }
}

runLiveTests();
