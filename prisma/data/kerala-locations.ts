export interface SeedLocation {
  name: string;
  slug: string;
  latitude: number;
  longitude: number;
  searchTerms?: string;
  /** Towns and localities nested under this city/district. */
  children?: SeedLocation[];
}

/** All 14 districts of Kerala, each with its principal cities and localities. */
export const KERALA_DISTRICTS: SeedLocation[] = [
  {
    name: 'Thiruvananthapuram',
    slug: 'thiruvananthapuram',
    latitude: 8.5241,
    longitude: 76.9366,
    searchTerms: 'trivandrum tvm anantapuri തിരുവനന്തപുരം',
    children: [
      {
        name: 'Thiruvananthapuram City',
        slug: 'thiruvananthapuram-city',
        latitude: 8.4875,
        longitude: 76.9525,
        children: [
          { name: 'Kovalam', slug: 'kovalam', latitude: 8.4004, longitude: 76.978 },
          { name: 'Technopark', slug: 'technopark-tvm', latitude: 8.5568, longitude: 76.8807 },
          { name: 'Kowdiar', slug: 'kowdiar', latitude: 8.5182, longitude: 76.9558 },
          { name: 'Varkala', slug: 'varkala', latitude: 8.7379, longitude: 76.7163 },
        ],
      },
      { name: 'Neyyattinkara', slug: 'neyyattinkara', latitude: 8.4004, longitude: 77.0857 },
      { name: 'Attingal', slug: 'attingal', latitude: 8.6968, longitude: 76.8155 },
    ],
  },
  {
    name: 'Kollam',
    slug: 'kollam',
    latitude: 8.8932,
    longitude: 76.6141,
    searchTerms: 'quilon കൊല്ലം',
    children: [
      {
        name: 'Kollam City',
        slug: 'kollam-city',
        latitude: 8.8932,
        longitude: 76.6141,
        children: [
          { name: 'Ashramam', slug: 'ashramam-kollam', latitude: 8.8912, longitude: 76.5878 },
          { name: 'Chinnakada', slug: 'chinnakada', latitude: 8.8848, longitude: 76.5931 },
        ],
      },
      { name: 'Punalur', slug: 'punalur', latitude: 9.0114, longitude: 76.9247 },
      { name: 'Karunagappally', slug: 'karunagappally', latitude: 9.0544, longitude: 76.5343 },
    ],
  },
  {
    name: 'Pathanamthitta',
    slug: 'pathanamthitta',
    latitude: 9.2648,
    longitude: 76.787,
    searchTerms: 'പത്തനംതിട്ട sabarimala',
    children: [
      { name: 'Adoor', slug: 'adoor', latitude: 9.1585, longitude: 76.7326 },
      { name: 'Thiruvalla', slug: 'thiruvalla', latitude: 9.3833, longitude: 76.5667 },
      { name: 'Ranni', slug: 'ranni', latitude: 9.3833, longitude: 76.7833 },
    ],
  },
  {
    name: 'Alappuzha',
    slug: 'alappuzha',
    latitude: 9.4981,
    longitude: 76.3388,
    searchTerms: 'alleppey backwaters ആലപ്പുഴ',
    children: [
      {
        name: 'Alappuzha Town',
        slug: 'alappuzha-town',
        latitude: 9.4981,
        longitude: 76.3388,
        children: [
          { name: 'Punnamada', slug: 'punnamada', latitude: 9.5262, longitude: 76.3494 },
          { name: 'Marari Beach', slug: 'marari-beach', latitude: 9.6, longitude: 76.3 },
        ],
      },
      { name: 'Cherthala', slug: 'cherthala', latitude: 9.6842, longitude: 76.3363 },
      { name: 'Kayamkulam', slug: 'kayamkulam', latitude: 9.1747, longitude: 76.5013 },
    ],
  },
  {
    name: 'Kottayam',
    slug: 'kottayam',
    latitude: 9.5916,
    longitude: 76.5222,
    searchTerms: 'കോട്ടയം letters lakes latex',
    children: [
      { name: 'Kottayam Town', slug: 'kottayam-town', latitude: 9.5916, longitude: 76.5222 },
      { name: 'Changanassery', slug: 'changanassery', latitude: 9.4419, longitude: 76.5411 },
      { name: 'Pala', slug: 'pala', latitude: 9.7107, longitude: 76.6832 },
      { name: 'Kumarakom', slug: 'kumarakom', latitude: 9.6178, longitude: 76.4274 },
    ],
  },
  {
    name: 'Idukki',
    slug: 'idukki',
    latitude: 9.85,
    longitude: 76.9667,
    searchTerms: 'ഇടുക്കി munnar highrange',
    children: [
      { name: 'Munnar', slug: 'munnar', latitude: 10.0889, longitude: 77.0595 },
      { name: 'Thodupuzha', slug: 'thodupuzha', latitude: 9.8955, longitude: 76.7185 },
      { name: 'Vagamon', slug: 'vagamon', latitude: 9.6857, longitude: 76.9036 },
    ],
  },
  {
    name: 'Ernakulam',
    slug: 'ernakulam',
    latitude: 9.9816,
    longitude: 76.2999,
    searchTerms: 'kochi cochin എറണാകുളം kakkanad',
    children: [
      {
        name: 'Kochi',
        slug: 'kochi',
        latitude: 9.9312,
        longitude: 76.2673,
        searchTerms: 'cochin ernakulam കൊച്ചി',
        children: [
          { name: 'Fort Kochi', slug: 'fort-kochi', latitude: 9.9658, longitude: 76.2421 },
          { name: 'Panampilly Nagar', slug: 'panampilly-nagar', latitude: 9.9586, longitude: 76.2969 },
          { name: 'Kakkanad', slug: 'kakkanad', latitude: 10.0158, longitude: 76.3419 },
          { name: 'Marine Drive', slug: 'marine-drive-kochi', latitude: 9.9847, longitude: 76.2761 },
          { name: 'Vyttila', slug: 'vyttila', latitude: 9.9682, longitude: 76.3187 },
          { name: 'Kadavanthra', slug: 'kadavanthra', latitude: 9.9662, longitude: 76.2998 },
          { name: 'Edappally', slug: 'edappally', latitude: 10.0261, longitude: 76.3082 },
        ],
      },
      { name: 'Aluva', slug: 'aluva', latitude: 10.1081, longitude: 76.3517 },
      { name: 'Perumbavoor', slug: 'perumbavoor', latitude: 10.1074, longitude: 76.4744 },
      { name: 'Muvattupuzha', slug: 'muvattupuzha', latitude: 9.9806, longitude: 76.5783 },
    ],
  },
  {
    name: 'Thrissur',
    slug: 'thrissur',
    latitude: 10.5276,
    longitude: 76.2144,
    searchTerms: 'trichur തൃശ്ശൂർ pooram culture capital',
    children: [
      {
        name: 'Thrissur City',
        slug: 'thrissur-city',
        latitude: 10.5276,
        longitude: 76.2144,
        children: [
          { name: 'Swaraj Round', slug: 'swaraj-round', latitude: 10.5265, longitude: 76.2141 },
          { name: 'Punkunnam', slug: 'punkunnam', latitude: 10.5334, longitude: 76.1963 },
        ],
      },
      { name: 'Chalakudy', slug: 'chalakudy', latitude: 10.3069, longitude: 76.3342 },
      { name: 'Guruvayur', slug: 'guruvayur', latitude: 10.5949, longitude: 76.0411 },
      { name: 'Irinjalakuda', slug: 'irinjalakuda', latitude: 10.3421, longitude: 76.2108 },
    ],
  },
  {
    name: 'Palakkad',
    slug: 'palakkad',
    latitude: 10.7867,
    longitude: 76.6548,
    searchTerms: 'palghat പാലക്കാട് granary',
    children: [
      { name: 'Palakkad Town', slug: 'palakkad-town', latitude: 10.7867, longitude: 76.6548 },
      { name: 'Ottapalam', slug: 'ottapalam', latitude: 10.7708, longitude: 76.3766 },
      { name: 'Shoranur', slug: 'shoranur', latitude: 10.7605, longitude: 76.2711 },
    ],
  },
  {
    name: 'Malappuram',
    slug: 'malappuram',
    latitude: 11.0732,
    longitude: 76.074,
    searchTerms: 'മലപ്പുറം football tirur',
    children: [
      { name: 'Malappuram Town', slug: 'malappuram-town', latitude: 11.0732, longitude: 76.074 },
      { name: 'Manjeri', slug: 'manjeri', latitude: 11.1204, longitude: 76.1197 },
      { name: 'Tirur', slug: 'tirur', latitude: 10.9135, longitude: 75.9218 },
      { name: 'Perinthalmanna', slug: 'perinthalmanna', latitude: 10.9748, longitude: 76.2276 },
    ],
  },
  {
    name: 'Kozhikode',
    slug: 'kozhikode',
    latitude: 11.2588,
    longitude: 75.7804,
    searchTerms: 'calicut കോഴിക്കോട് malabar city of literature',
    children: [
      {
        name: 'Kozhikode City',
        slug: 'kozhikode-city',
        latitude: 11.2588,
        longitude: 75.7804,
        searchTerms: 'calicut malabar',
        children: [
          { name: 'Kozhikode Beach', slug: 'kozhikode-beach', latitude: 11.2492, longitude: 75.7695 },
          { name: 'Mavoor Road', slug: 'mavoor-road', latitude: 11.2543, longitude: 75.7936 },
          { name: 'West Hill', slug: 'west-hill', latitude: 11.2836, longitude: 75.7716 },
          { name: 'Thondayad', slug: 'thondayad', latitude: 11.2761, longitude: 75.8199 },
          { name: 'Kakkodi', slug: 'kakkodi', latitude: 11.3234, longitude: 75.8189 },
        ],
      },
      { name: 'Vadakara', slug: 'vadakara', latitude: 11.6014, longitude: 75.5921 },
      { name: 'Koyilandy', slug: 'koyilandy', latitude: 11.4419, longitude: 75.6947 },
      { name: 'Ramanattukara', slug: 'ramanattukara', latitude: 11.1697, longitude: 75.8474 },
    ],
  },
  {
    name: 'Wayanad',
    slug: 'wayanad',
    latitude: 11.6854,
    longitude: 76.132,
    searchTerms: 'വയനാട് hills trekking kalpetta',
    children: [
      { name: 'Kalpetta', slug: 'kalpetta', latitude: 11.6087, longitude: 76.083 },
      { name: 'Sultan Bathery', slug: 'sultan-bathery', latitude: 11.6647, longitude: 76.2597 },
      { name: 'Mananthavady', slug: 'mananthavady', latitude: 11.8016, longitude: 76.0021 },
    ],
  },
  {
    name: 'Kannur',
    slug: 'kannur',
    latitude: 11.8745,
    longitude: 75.3704,
    searchTerms: 'cannanore കണ്ണൂർ theyyam',
    children: [
      { name: 'Kannur Town', slug: 'kannur-town', latitude: 11.8745, longitude: 75.3704 },
      { name: 'Thalassery', slug: 'thalassery', latitude: 11.7481, longitude: 75.4929 },
      { name: 'Payyanur', slug: 'payyanur', latitude: 12.0977, longitude: 75.2019 },
    ],
  },
  {
    name: 'Kasaragod',
    slug: 'kasaragod',
    latitude: 12.4996,
    longitude: 74.9869,
    searchTerms: 'കാസർഗോഡ് bekal seven languages',
    children: [
      { name: 'Kasaragod Town', slug: 'kasaragod-town', latitude: 12.4996, longitude: 74.9869 },
      { name: 'Kanhangad', slug: 'kanhangad', latitude: 12.3152, longitude: 75.0955 },
      { name: 'Bekal', slug: 'bekal', latitude: 12.3908, longitude: 75.0324 },
    ],
  },
];

export interface SeedDiasporaHub {
  city: string;
  slug: string;
  country: string;
  countryCode: string;
  countrySlug: string;
  timezone: string;
  latitude: number;
  longitude: number;
  searchTerms?: string;
}

/** Cities with the largest Malayali populations outside Kerala. */
export const DIASPORA_HUBS: SeedDiasporaHub[] = [
  { city: 'Dubai', slug: 'dubai', country: 'United Arab Emirates', countryCode: 'AE', countrySlug: 'united-arab-emirates', timezone: 'Asia/Dubai', latitude: 25.2048, longitude: 55.2708, searchTerms: 'uae gulf pravasi' },
  { city: 'Abu Dhabi', slug: 'abu-dhabi', country: 'United Arab Emirates', countryCode: 'AE', countrySlug: 'united-arab-emirates', timezone: 'Asia/Dubai', latitude: 24.4539, longitude: 54.3773 },
  { city: 'Sharjah', slug: 'sharjah', country: 'United Arab Emirates', countryCode: 'AE', countrySlug: 'united-arab-emirates', timezone: 'Asia/Dubai', latitude: 25.3463, longitude: 55.4209 },
  { city: 'Doha', slug: 'doha', country: 'Qatar', countryCode: 'QA', countrySlug: 'qatar', timezone: 'Asia/Qatar', latitude: 25.2854, longitude: 51.531 },
  { city: 'Muscat', slug: 'muscat', country: 'Oman', countryCode: 'OM', countrySlug: 'oman', timezone: 'Asia/Muscat', latitude: 23.5859, longitude: 58.4059 },
  { city: 'Riyadh', slug: 'riyadh', country: 'Saudi Arabia', countryCode: 'SA', countrySlug: 'saudi-arabia', timezone: 'Asia/Riyadh', latitude: 24.7136, longitude: 46.6753 },
  { city: 'Manama', slug: 'manama', country: 'Bahrain', countryCode: 'BH', countrySlug: 'bahrain', timezone: 'Asia/Bahrain', latitude: 26.2285, longitude: 50.586 },
  { city: 'Kuwait City', slug: 'kuwait-city', country: 'Kuwait', countryCode: 'KW', countrySlug: 'kuwait', timezone: 'Asia/Kuwait', latitude: 29.3759, longitude: 47.9774 },
  { city: 'Bengaluru', slug: 'bengaluru', country: 'India', countryCode: 'IN', countrySlug: 'india', timezone: 'Asia/Kolkata', latitude: 12.9716, longitude: 77.5946, searchTerms: 'bangalore blr' },
  { city: 'Chennai', slug: 'chennai', country: 'India', countryCode: 'IN', countrySlug: 'india', timezone: 'Asia/Kolkata', latitude: 13.0827, longitude: 80.2707 },
  { city: 'Mumbai', slug: 'mumbai', country: 'India', countryCode: 'IN', countrySlug: 'india', timezone: 'Asia/Kolkata', latitude: 19.076, longitude: 72.8777 },
  { city: 'Hyderabad', slug: 'hyderabad', country: 'India', countryCode: 'IN', countrySlug: 'india', timezone: 'Asia/Kolkata', latitude: 17.385, longitude: 78.4867 },
  { city: 'Pune', slug: 'pune', country: 'India', countryCode: 'IN', countrySlug: 'india', timezone: 'Asia/Kolkata', latitude: 18.5204, longitude: 73.8567 },
  { city: 'Delhi', slug: 'delhi', country: 'India', countryCode: 'IN', countrySlug: 'india', timezone: 'Asia/Kolkata', latitude: 28.6139, longitude: 77.209 },
  { city: 'London', slug: 'london', country: 'United Kingdom', countryCode: 'GB', countrySlug: 'united-kingdom', timezone: 'Europe/London', latitude: 51.5072, longitude: -0.1276 },
  { city: 'Manchester', slug: 'manchester', country: 'United Kingdom', countryCode: 'GB', countrySlug: 'united-kingdom', timezone: 'Europe/London', latitude: 53.4808, longitude: -2.2426 },
  { city: 'Dublin', slug: 'dublin', country: 'Ireland', countryCode: 'IE', countrySlug: 'ireland', timezone: 'Europe/Dublin', latitude: 53.3498, longitude: -6.2603 },
  { city: 'Toronto', slug: 'toronto', country: 'Canada', countryCode: 'CA', countrySlug: 'canada', timezone: 'America/Toronto', latitude: 43.6532, longitude: -79.3832 },
  { city: 'New York', slug: 'new-york', country: 'United States', countryCode: 'US', countrySlug: 'united-states', timezone: 'America/New_York', latitude: 40.7128, longitude: -74.006 },
  { city: 'Chicago', slug: 'chicago', country: 'United States', countryCode: 'US', countrySlug: 'united-states', timezone: 'America/Chicago', latitude: 41.8781, longitude: -87.6298 },
  { city: 'Singapore', slug: 'singapore', country: 'Singapore', countryCode: 'SG', countrySlug: 'singapore', timezone: 'Asia/Singapore', latitude: 1.3521, longitude: 103.8198 },
  { city: 'Sydney', slug: 'sydney', country: 'Australia', countryCode: 'AU', countrySlug: 'australia', timezone: 'Australia/Sydney', latitude: -33.8688, longitude: 151.2093 },
  { city: 'Melbourne', slug: 'melbourne', country: 'Australia', countryCode: 'AU', countrySlug: 'australia', timezone: 'Australia/Melbourne', latitude: -37.8136, longitude: 144.9631 },
  { city: 'Frankfurt', slug: 'frankfurt', country: 'Germany', countryCode: 'DE', countrySlug: 'germany', timezone: 'Europe/Berlin', latitude: 50.1109, longitude: 8.6821 },
];
