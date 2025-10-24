// Test script for staff management API
async function testStaffAPI() {
  const baseUrl = 'http://localhost:3000'
  
  // Test GET endpoint
  console.log('Testing GET /api/staff-management...')
  try {
    const response = await fetch(`${baseUrl}/api/staff-management?orgId=test-org-id`)
    const data = await response.json()
    console.log('GET Response:', response.status, data)
  } catch (error) {
    console.error('GET Error:', error)
  }
  
  // Test if the route is accessible
  console.log('\nTesting route accessibility...')
  try {
    const response = await fetch(`${baseUrl}/api/staff-management`)
    console.log('Route status:', response.status)
    const data = await response.json()
    console.log('Route response:', data)
  } catch (error) {
    console.error('Route Error:', error)
  }
}

testStaffAPI()

