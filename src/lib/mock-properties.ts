import prop1 from "@/assets/prop-1.jpg";
import prop2 from "@/assets/prop-2.jpg";
import prop3 from "@/assets/prop-3.jpg";
import prop4 from "@/assets/prop-4.jpg";

export type MockProperty = {
  id: string;
  title: string;
  city: string;
  locality: string;
  price: number;
  listing_type: "rent" | "sale" | "pg";
  property_type: string;
  bedrooms: number;
  bathrooms: number;
  area_sqft: number;
  furnished: string;
  image: string;
  verified: boolean;
  amenities: string[];
  description: string;
  lat: number;
  lng: number;
  floor?: string;
  total_floors?: number;
  age_years?: string;
  facing?: string;
  rera_id?: string;
  available_from?: string;
  carpet_area?: number;
};

export const mockProperties: MockProperty[] = [
  {
    id: "p1",
    title: "Luxe 2BHK in Prahladnagar",
    city: "Ahmedabad", locality: "Prahladnagar",
    price: 28000, listing_type: "rent", property_type: "Apartment",
    bedrooms: 2, bathrooms: 2, area_sqft: 1180, carpet_area: 980,
    furnished: "Semi-Furnished", image: prop1, verified: true,
    lat: 23.0225, lng: 72.5714,
    amenities: ["WiFi", "Air Conditioning", "Parking", "Gym", "Lift/Elevator", "Power Backup", "Pet Friendly", "CCTV Security", "Swimming Pool", "Clubhouse", "Balcony", "Intercom"],
    description: "Welcome to a beautifully designed serviced apartment in Bopal, Ahmedabad. This modern home offers a comfortable living environment with thoughtfully designed interiors, natural light, essential amenities and convenient access to everyday services.",
    floor: "8th", total_floors: 14, age_years: "2-5 years", facing: "East",
    rera_id: "GJ/REA/NV02345", available_from: "35 May",
  },
  {
    id: "p2",
    title: "Signature 4BHK Villa with Pool",
    city: "Surat", locality: "Vesu",
    price: 24500000, listing_type: "sale", property_type: "Villa",
    bedrooms: 4, bathrooms: 4, area_sqft: 3800, carpet_area: 3200,
    furnished: "Fully Furnished", image: prop2, verified: true,
    lat: 21.1702, lng: 72.8311,
    amenities: ["Private Pool", "Garden", "Smart Home", "Home Theater", "Servant Room", "Parking", "Power Backup", "CCTV Security", "Gym", "Balcony"],
    description: "A premium waterfront villa with private pool, expansive gardens and smart-home automation. Ideal for families seeking luxury living in Surat's most coveted address.",
    floor: "Ground", total_floors: 2, age_years: "0-2 years", facing: "North",
    rera_id: "GJ/REA/NV03210", available_from: "Immediate",
  },
  {
    id: "p3",
    title: "Grade-A Office Space, SG Highway",
    city: "Ahmedabad", locality: "SG Highway",
    price: 85000, listing_type: "rent", property_type: "Office Space",
    bedrooms: 0, bathrooms: 2, area_sqft: 2400, carpet_area: 2050,
    furnished: "Fully Furnished", image: prop3, verified: false,
    lat: 23.0469, lng: 72.5058,
    amenities: ["24x7 Security", "Conference Room", "Cafeteria", "High-speed Elevator", "Parking", "Power Backup", "WiFi", "Air Conditioning"],
    description: "Grade-A commercial office with panoramic city views and plug-and-play interiors on SG Highway — Gujarat's premium commercial corridor.",
    floor: "12th", total_floors: 20, age_years: "0-2 years", facing: "West",
    rera_id: "GJ/REA/NV04120", available_from: "Immediate",
  },
  {
    id: "p4",
    title: "Premium PG for Students – Navrangpura",
    city: "Ahmedabad", locality: "Navrangpura",
    price: 9500, listing_type: "pg", property_type: "PG",
    bedrooms: 1, bathrooms: 1, area_sqft: 220, carpet_area: 180,
    furnished: "Fully Furnished", image: prop4, verified: true,
    lat: 23.0300, lng: 72.5600,
    amenities: ["Meals Included", "WiFi", "Laundry", "Air Conditioning", "CCTV Security", "Power Backup", "Water Supply 24/7"],
    description: "Well-managed PG with home-style meals, high-speed WiFi and 24×7 security. Walking distance to major colleges and hospitals in Navrangpura.",
    floor: "2nd", total_floors: 4, age_years: "5-10 years", facing: "South",
    rera_id: "N/A", available_from: "Immediate",
  },
  {
    id: "p5",
    title: "Skyline 3BHK in Bopal",
    city: "Ahmedabad", locality: "Bopal",
    price: 42000, listing_type: "rent", property_type: "Apartment",
    bedrooms: 3, bathrooms: 3, area_sqft: 1650, carpet_area: 1400,
    furnished: "Semi-Furnished", image: prop1, verified: true,
    lat: 23.0150, lng: 72.4700,
    amenities: ["Clubhouse", "Swimming Pool", "Kids Area", "Parking", "Gym", "WiFi", "Power Backup", "CCTV Security", "Lift/Elevator", "Balcony"],
    description: "High-floor 3BHK with skyline views, premium clubhouse and family-friendly amenities in Bopal. Well connected to SG Highway, Ring Road and Bopal Bus Stop.",
    floor: "11th", total_floors: 18, age_years: "2-5 years", facing: "East",
    rera_id: "GJ/REA/NV05890", available_from: "25 May",
  },
  {
    id: "p6",
    title: "Boutique Villa – Adajan Riverside",
    city: "Surat", locality: "Adajan",
    price: 18500000, listing_type: "sale", property_type: "Villa",
    bedrooms: 3, bathrooms: 3, area_sqft: 2900, carpet_area: 2400,
    furnished: "Semi-Furnished", image: prop2, verified: false,
    lat: 21.1950, lng: 72.8050,
    amenities: ["Garden", "Parking", "Solar Panels", "Power Backup", "CCTV Security", "Balcony", "Water Supply 24/7"],
    description: "Boutique riverside villa with mature landscaping and solar-ready infrastructure in Adajan — one of Surat's most sought-after localities.",
    floor: "Ground", total_floors: 2, age_years: "5-10 years", facing: "North-East",
    rera_id: "GJ/REA/NV06541", available_from: "Immediate",
  },
  // Extra properties for map markers & similar sections
  {
    id: "p7",
    title: "3 BHK in Thaltej",
    city: "Ahmedabad", locality: "Thaltej",
    price: 25000, listing_type: "rent", property_type: "Apartment",
    bedrooms: 3, bathrooms: 2, area_sqft: 1100,
    furnished: "Semi-Furnished", image: prop1, verified: true,
    lat: 23.0549, lng: 72.5100,
    amenities: ["Parking", "Lift/Elevator", "Power Backup", "WiFi"],
    description: "Comfortable 3BHK in the heart of Thaltej with easy access to SG Highway.",
  },
  {
    id: "p8",
    title: "3 BHK in Satellite",
    city: "Ahmedabad", locality: "Satellite",
    price: 35000, listing_type: "rent", property_type: "Apartment",
    bedrooms: 3, bathrooms: 2, area_sqft: 1550,
    furnished: "Fully Furnished", image: prop2, verified: false,
    lat: 23.0200, lng: 72.5200,
    amenities: ["Gym", "Swimming Pool", "Parking", "CCTV Security"],
    description: "Fully furnished 3BHK in Satellite with top-class amenities.",
  },
  {
    id: "p9",
    title: "Villa in Shilaj",
    city: "Ahmedabad", locality: "Shilaj",
    price: 55000, listing_type: "rent", property_type: "Villa",
    bedrooms: 4, bathrooms: 4, area_sqft: 2400,
    furnished: "Fully Furnished", image: prop3, verified: true,
    lat: 23.0650, lng: 72.4800,
    amenities: ["Private Garden", "Parking", "Gym", "Swimming Pool"],
    description: "Spacious villa in Shilaj with private garden and top amenities.",
  },
  {
    id: "p10",
    title: "Studio Apartment",
    city: "Ahmedabad", locality: "Vastrapur",
    price: 50060, listing_type: "rent", property_type: "Apartment",
    bedrooms: 1, bathrooms: 1, area_sqft: 1700,
    furnished: "Fully Furnished", image: prop4, verified: true,
    lat: 23.0350, lng: 72.5280,
    amenities: ["WiFi", "Air Conditioning", "Security"],
    description: "Modern studio apartment near Vastrapur Lake.",
  },
  {
    id: "p11",
    title: "Studio in Navrangpura",
    city: "Ahmedabad", locality: "Navrangpura",
    price: 25000, listing_type: "rent", property_type: "Apartment",
    bedrooms: 1, bathrooms: 1, area_sqft: 800,
    furnished: "Semi-Furnished", image: prop1, verified: false,
    lat: 23.0380, lng: 72.5620,
    amenities: ["WiFi", "Power Backup", "Security"],
    description: "Cozy studio in Navrangpura, close to CG Road.",
  },
  {
    id: "p12",
    title: "2 BHK in Prahlad Nagar",
    city: "Ahmedabad", locality: "Prahlad Nagar",
    price: 19000, listing_type: "rent", property_type: "Apartment",
    bedrooms: 2, bathrooms: 2, area_sqft: 600,
    furnished: "Unfurnished", image: prop2, verified: true,
    lat: 23.0180, lng: 72.5080,
    amenities: ["Parking", "Lift/Elevator", "Power Backup"],
    description: "Affordable 2BHK in Prahlad Nagar with basic amenities.",
  },
];

export const cities = ["Ahmedabad", "Surat", "Vadodara", "Rajkot", "Gandhinagar", "Bhavnagar"];
export const propertyTypes = ["Apartment", "Villa", "PG", "Office Space", "Plot", "Warehouse", "Farm House"];

export function formatINR(n: number) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000)   return `₹${(n / 100000).toFixed(2)} L`;
  return `₹${n.toLocaleString("en-IN")}`;
}

// Compact price for map markers — ₹21,580 → ₹21.6k  |  ₹85000 → ₹85k  |  crore untouched
export function formatMarkerPrice(n: number) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000)   return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000)     return `₹${Math.round(n / 1000)}k`;
  return `₹${n}`;
}
