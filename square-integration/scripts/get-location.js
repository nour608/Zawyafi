import { Client, Environment } from 'square';

const client = new Client({
  accessToken: 'EAAAl_N-zhyC69107ortxf2yJQMpZQFJZpVajsA2ygbu-wvgzVuOpUteJ1AahzaO',
  environment: Environment.Sandbox
});

async function getLocationId() {
  try {
    const response = await client.locationsApi.listLocations();
    const locations = response.result.locations || [];
    
    console.log('Square Sandbox Locations:\n');
    locations.forEach(loc => {
      console.log(`Location ID: ${loc.id}`);
      console.log(`Name: ${loc.name}`);
      console.log(`Address: ${loc.address?.addressLine1 || 'N/A'}`);
      console.log(`Status: ${loc.status}\n`);
    });
    
    if (locations.length > 0) {
      console.log(`\nUse this location ID: ${locations[0].id}`);
      return locations[0].id;
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

getLocationId();
