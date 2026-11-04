let travelPackages = [];

async function loadTravelPackages() {
  const response = await fetch('data/travel-packages.json');
  if (!response.ok) throw new Error('Could not load travel package data.');
  const packageData = await response.json();
  if (!Array.isArray(packageData) || packageData.length === 0) {
    throw new Error('Travel package data is empty or invalid.');
  }

  const packageNames = new Set();
  packageData.forEach((pkg) => {
    const durationNights = Number(String(pkg.duration || '').match(/(\d+)\s*nights?/i)?.[1]);
    const hasValidRates = ['hotelRate', 'activityRate', 'transportRate', 'foodRate', 'otherCost']
      .every((key) => Number.isFinite(pkg[key]) && pkg[key] >= 0);
    const normalizedName = typeof pkg?.name === 'string' ? pkg.name.trim().toLocaleLowerCase() : '';
    if (!pkg || !normalizedName || packageNames.has(normalizedName)
      || typeof pkg.country !== 'string' || !pkg.country.trim()
      || typeof pkg.duration !== 'string' || !Number.isInteger(pkg.nights) || pkg.nights < 1
      || durationNights !== pkg.nights || !Number.isFinite(pkg.price) || pkg.price <= 0 || !hasValidRates) {
      throw new Error('Travel package data contains an invalid or duplicate package.');
    }
    packageNames.add(normalizedName);
  });

  travelPackages = packageData.map((pkg) => ({
    ...pkg,
    category: pkg.country === 'India' ? 'Domestic' : 'International'
  }));
}

function formatINR(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(Number.isFinite(value) ? value : 0);
}

function getPackageByName(name) {
  return travelPackages.find((pkg) => pkg.name === name) || null;
}

function getPackageFromCardTitle(title) {
  const cleanTitle = String(title || '').trim();
  return travelPackages.find((pkg) => pkg.name === cleanTitle || pkg.name.startsWith(`${cleanTitle} `)) || null;
}

function updatePackageCards() {
  document.querySelectorAll('.card').forEach((card) => {
    const title = card.querySelector('h3')?.textContent;
    const packageItem = getPackageFromCardTitle(title);
    if (!packageItem) return;

    card.dataset.category = packageItem.category;
    const priceTag = card.querySelector('.price-tag');
    if (priceTag) {
      const prefix = priceTag.textContent.trim().startsWith('From') ? 'From ' : '';
      priceTag.textContent = `${prefix}${formatINR(packageItem.price)} per person`;
    }

    const packagePrice = card.querySelector('.package-card .meta-list li:last-child');
    if (packagePrice && /\d/.test(packagePrice.textContent)) {
      packagePrice.textContent = `${formatINR(packageItem.price)} per person`;
    }
  });
}

function initializePackageDeparture() {
  const cityInput = document.getElementById('packages-departure-city');
  if (!cityInput) return;

  document.querySelectorAll('.package-card .card-link').forEach((link) => {
    link.addEventListener('click', () => {
      const city = cityInput.value.trim();
      if (!city) return;
      const bookingUrl = new URL(link.href);
      bookingUrl.searchParams.set('departure_city', city.slice(0, 120));
      link.href = bookingUrl.href;
    });
  });
}

function isDomesticPackage(packageItem) {
  return packageItem && packageItem.country === 'India';
}

function setFieldValue(fieldId, value) {
  const element = document.getElementById(fieldId);
  if (element) {
    element.value = value;
  }
}

function setTextValue(fieldId, value) {
  const element = document.getElementById(fieldId);
  if (element) {
    element.textContent = value;
  }
}

function getTodayISODate() {
  const today = new Date();
  const offset = today.getTimezoneOffset() * 60000;
  return new Date(today.getTime() - offset).toISOString().slice(0, 10);
}

function parseNightsFromDuration(duration) {
  const match = String(duration).match(/(\d+)\s*nights?/i);
  return match ? Number(match[1]) : 2;
}

function clampNumber(value, fallback, min, max) {
  if (value === '' || value === null || value === undefined) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(parsed, min), max);
}

function getEditableNumberState(input, min, max) {
  const raw = String(input.value ?? '').trim();
  if (raw === '') {
    return { isValid: false, value: '' };
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    return { isValid: false, value: '' };
  }

  return { isValid: true, value: parsed };
}

function populateDestinationOptions(selectElement, defaultName) {
  if (!selectElement) return;

  selectElement.innerHTML = '';
  const domesticGroup = document.createElement('optgroup');
  domesticGroup.label = 'Domestic packages';
  const internationalGroup = document.createElement('optgroup');
  internationalGroup.label = 'International packages';

  travelPackages.forEach((pkg) => {
    const option = document.createElement('option');
    option.value = pkg.name;
    option.textContent = `${pkg.name} — ${formatINR(pkg.price)}`;
    option.dataset.category = pkg.category;

    if (pkg.category === 'Domestic') {
      domesticGroup.appendChild(option);
    } else {
      internationalGroup.appendChild(option);
    }
  });

  selectElement.appendChild(domesticGroup);
  selectElement.appendChild(internationalGroup);

  if (defaultName && getPackageByName(defaultName)) {
    selectElement.value = defaultName;
  } else {
    selectElement.value = travelPackages[0]?.name || '';
  }
}

function calculateTripCost(destinationName, adults, children, nights, accommodationMultiplier = 1) {
  const selectedPackage = getPackageByName(destinationName);
  if (!selectedPackage) {
    return { hotel: 0, activity: 0, transport: 0, food: 0, other: 0, total: 0 };
  }

  const totalTravellers = adults + children;
  const roomsNeeded = Math.max(1, Math.ceil(adults / 2));
  const hotel = selectedPackage.hotelRate * nights * roomsNeeded * accommodationMultiplier;
  const activity = selectedPackage.activityRate * totalTravellers;
  const transport = selectedPackage.transportRate * Math.max(1, Math.ceil(totalTravellers / 3));
  const food = selectedPackage.foodRate * totalTravellers * nights;
  const other = selectedPackage.otherCost + Math.max(0, totalTravellers - 2) * 120;

  return {
    hotel,
    activity,
    transport,
    food,
    other,
    total: hotel + activity + transport + food + other
  };
}

const departureSuggestions = {
  airport: {
    'Ahmedabad': ['Sardar Vallabhbhai Patel International Airport (AMD)'],
    'Bengaluru': ['Kempegowda International Airport (BLR)'],
    'Chennai': ['Chennai International Airport (MAA)'],
    'Delhi': ['Indira Gandhi International Airport (DEL)'],
    'Goa': ['Manohar International Airport (GOX)', 'Dabolim Airport (GOI)'],
    'Hyderabad': ['Rajiv Gandhi International Airport (HYD)'],
    'Kolkata': ['Netaji Subhas Chandra Bose International Airport (CCU)'],
    'Mumbai': ['Chhatrapati Shivaji Maharaj International Airport (BOM)'],
    'Pune': ['Pune Airport (PNQ)'],
    'Jaipur': ['Jaipur International Airport (JAI)'],
    'Kochi': ['Cochin International Airport (COK)'],
    'Srinagar': ['Sheikh ul-Alam International Airport (SXR)'],
    'Port Blair': ['Veer Savarkar International Airport (IXZ)'],
    'Dehradun': ['Jolly Grant Airport (DED)'],
    'Varanasi': ['Lal Bahadur Shastri International Airport (VNS)'],
    'Udaipur': ['Maharana Pratap Airport (UDR)'],
    'Mangaluru': ['Mangaluru International Airport (IXE)'],
    'Madurai': ['Madurai Airport (IXM)'],
    'Thiruvananthapuram': ['Thiruvananthapuram International Airport (TRV)']
  },
  station: {
    'Ahmedabad': ['Ahmedabad Junction (ADI)'],
    'Bengaluru': ['Krantivira Sangolli Rayanna Bengaluru Station (SBC)'],
    'Chennai': ['Chennai Central (MAS)'],
    'Delhi': ['New Delhi Railway Station (NDLS)'],
    'Goa': ['Madgaon Junction (MAO)'],
    'Hyderabad': ['Secunderabad Junction (SC)'],
    'Kolkata': ['Howrah Junction (HWH)'],
    'Mumbai': ['Chhatrapati Shivaji Maharaj Terminus (CSMT)'],
    'Pune': ['Pune Junction (PUNE)'],
    'Jaipur': ['Jaipur Junction (JP)'],
    'Kochi': ['Ernakulam Junction (ERS)'],
    'Dehradun': ['Dehradun Railway Station (DDN)'],
    'Varanasi': ['Varanasi Junction (BSB)'],
    'Udaipur': ['Udaipur City Railway Station (UDZ)'],
    'Mangaluru': ['Mangaluru Central (MAQ)'],
    'Madurai': ['Madurai Junction (MDU)'],
    'Thiruvananthapuram': ['Thiruvananthapuram Central (TVC)']
  }
};

function populateDepartureCityLists() {
  const cities = [...new Set([...Object.keys(departureSuggestions.airport), ...Object.keys(departureSuggestions.station)])];
  ['calculator-departure-cities', 'packages-departure-cities'].forEach((listId) => {
    const list = document.getElementById(listId);
    if (!list) return;
    cities.forEach((city) => {
      const option = document.createElement('option');
      option.value = city;
      list.appendChild(option);
    });
  });
}

function updateDepartureSuggestions() {
  const cityInput = document.getElementById('departure-city');
  const cityList = document.getElementById('departure-city-suggestions');
  const locationInput = document.getElementById('departure-location');
  const locationList = document.getElementById('departure-location-suggestions');
  const selectedMode = document.querySelector('input[name="travel_mode_choice"]:checked')?.value;
  if (!cityInput || !locationInput || !locationList) return;

  if (selectedMode !== 'Train' && selectedMode !== 'Flight') {
    locationList.replaceChildren();
    locationInput.value = '';
    locationInput.dataset.suggestedValue = '';
    return;
  }

  const kind = selectedMode === 'Flight' ? 'airport' : 'station';
  if (cityList && !cityList.dataset.loaded) {
    const cities = [...new Set([...Object.keys(departureSuggestions.airport), ...Object.keys(departureSuggestions.station)])];
    cities.forEach((city) => {
      const option = document.createElement('option');
      option.value = city;
      cityList.appendChild(option);
    });
    cityList.dataset.loaded = 'true';
  }
  const cityKey = Object.keys(departureSuggestions[kind]).find((city) => city.toLowerCase() === cityInput.value.trim().toLowerCase());
  const suggestions = cityKey ? departureSuggestions[kind][cityKey] : [];
  locationList.replaceChildren();
  suggestions.forEach((name) => {
    const option = document.createElement('option');
    option.value = name;
    locationList.appendChild(option);
  });

  const previousSuggestion = locationInput.dataset.suggestedValue || '';
  if (previousSuggestion && locationInput.value === previousSuggestion && !suggestions.includes(previousSuggestion)) {
    locationInput.value = '';
  }
  locationInput.dataset.suggestedValue = suggestions[0] || '';
}

function updateDepartureLocationControls(packageItem, selectedMode) {
  const isDomestic = isDomesticPackage(packageItem);
  const cityField = document.getElementById('departure-city-field');
  const locationField = document.getElementById('departure-location-field');
  const cityInput = document.getElementById('departure-city');
  const locationInput = document.getElementById('departure-location');
  const locationLabel = document.getElementById('departure-location-label');
  const summary = document.getElementById('booking-summary-departure');

  if (!cityField || !locationField || !cityInput || !locationInput) return;
  cityField.hidden = false;
  cityInput.disabled = false;
  cityInput.required = true;
  locationField.hidden = !isDomestic;
  locationInput.disabled = !isDomestic;
  locationInput.required = isDomestic;

  if (!isDomestic) {
    locationInput.value = '';
    locationInput.dataset.suggestedValue = '';
    document.getElementById('departure-location-suggestions')?.replaceChildren();
    if (summary) summary.textContent = cityInput.value.trim() || 'Enter your departure city';
    return;
  }

  if (selectedMode !== 'Train' && selectedMode !== 'Flight') {
    locationInput.value = '';
    locationInput.dataset.suggestedValue = '';
    document.getElementById('departure-location-suggestions')?.replaceChildren();
    if (summary) summary.textContent = cityInput.value.trim() || 'Choose your departure city and location';
    return;
  }

  const isFlight = selectedMode === 'Flight';
  if (locationLabel) locationLabel.textContent = isFlight ? 'Departure Airport' : 'Departure Railway Station';
  locationInput.placeholder = isFlight ? 'Select or enter an airport' : 'Select or enter a railway station';
  updateDepartureSuggestions();
  const departureText = [locationInput.value.trim(), cityInput.value.trim()].filter(Boolean).join(', ');
  if (summary) summary.textContent = departureText || 'Choose your departure city and location';
}

function resetCostBoxes() {
  const boxes = ['hotel-cost', 'activity-cost', 'transport-cost', 'food-cost', 'other-cost', 'estimated-total'];
  boxes.forEach((id) => {
    const element = document.getElementById(id);
    if (element) element.textContent = '—';
  });
}

function updateCalculatorDisplay() {
  const destinationSelect = document.getElementById('calculator-destination');
  const adultsInput = document.getElementById('adult-count');
  const childrenInput = document.getElementById('child-count');
  const nightsInput = document.getElementById('night-count');
  const accommodationInput = document.getElementById('accommodation-level');
  const hotelBox = document.getElementById('hotel-cost');
  const activityBox = document.getElementById('activity-cost');
  const transportBox = document.getElementById('transport-cost');
  const foodBox = document.getElementById('food-cost');
  const otherBox = document.getElementById('other-cost');
  const totalBox = document.getElementById('estimated-total');
  const bookButton = document.getElementById('calculator-book');
  const validationMessage = document.getElementById('calculator-validation');

  if (!destinationSelect || !adultsInput || !childrenInput || !nightsInput) return;

  const adultsState = getEditableNumberState(adultsInput, 1, 20);
  const childrenState = getEditableNumberState(childrenInput, 0, 20);
  const nightsState = getEditableNumberState(nightsInput, 1, 30);

  if (!adultsState.isValid || !childrenState.isValid || !nightsState.isValid) {
    resetCostBoxes();
    if (bookButton) bookButton.disabled = true;
    if (validationMessage) validationMessage.hidden = false;
    return;
  }

  let adults = adultsState.value;
  let children = childrenState.value;
  let nights = nightsState.value;

  if (adults + children > 20) {
    resetCostBoxes();
    if (bookButton) bookButton.disabled = true;
    if (validationMessage) validationMessage.hidden = false;
    return;
  }

  if (bookButton) bookButton.disabled = false;
  if (validationMessage) validationMessage.hidden = true;

  const accommodationMultiplier = accommodationInput ? Number(accommodationInput.value) || 1 : 1;
  const costBreakdown = calculateTripCost(destinationSelect.value, adults, children, nights, accommodationMultiplier);

  if (hotelBox) hotelBox.textContent = formatINR(costBreakdown.hotel);
  if (activityBox) activityBox.textContent = formatINR(costBreakdown.activity);
  if (transportBox) transportBox.textContent = formatINR(costBreakdown.transport);
  if (foodBox) foodBox.textContent = formatINR(costBreakdown.food);
  if (otherBox) otherBox.textContent = formatINR(costBreakdown.other);
  if (totalBox) totalBox.textContent = formatINR(costBreakdown.total);
}

function initializeCalculator() {
  const destinationSelect = document.getElementById('calculator-destination');
  const adultsInput = document.getElementById('adult-count');
  const childrenInput = document.getElementById('child-count');
  const nightsInput = document.getElementById('night-count');
  const resetButton = document.getElementById('reset-calculator');
  const bookButton = document.getElementById('calculator-book');
  const departureCityInput = document.getElementById('calculator-departure-city');

  if (!destinationSelect || !adultsInput || !childrenInput || !nightsInput) return;

  populateDestinationOptions(destinationSelect, 'Goa Beach Holiday');
  adultsInput.value = '1';
  childrenInput.value = '0';
  nightsInput.value = '2';

  destinationSelect.addEventListener('change', () => {
    const selectedPackage = getPackageByName(destinationSelect.value);
    if (selectedPackage) {
      nightsInput.value = String(parseNightsFromDuration(selectedPackage.duration));
    }
    updateCalculatorDisplay();
  });

  adultsInput.addEventListener('input', updateCalculatorDisplay);
  childrenInput.addEventListener('input', updateCalculatorDisplay);
  nightsInput.addEventListener('input', updateCalculatorDisplay);
  const accommodationInput = document.getElementById('accommodation-level');
  if (accommodationInput) accommodationInput.addEventListener('change', updateCalculatorDisplay);

  document.addEventListener('wheel', (event) => {
    if (event.target instanceof HTMLElement && event.target.matches('input[type="number"]')) {
      event.preventDefault();
    }
  }, { passive: false });

  if (resetButton) {
    resetButton.addEventListener('click', () => {
      destinationSelect.value = 'Goa Beach Holiday';
      adultsInput.value = '1';
      childrenInput.value = '0';
      nightsInput.value = '2';
      updateCalculatorDisplay();
    });
  }

  if (bookButton) {
    bookButton.addEventListener('click', () => {
      updateCalculatorDisplay();
      if (bookButton.disabled) return;

      const selectedDestination = destinationSelect.value;
      const adults = Number(adultsInput.value);
      const children = Number(childrenInput.value);
      const totalTravellers = adults + children;
      const params = new URLSearchParams({
        destination: selectedDestination,
        adults: adults,
        children: children,
        travellers: Math.min(totalTravellers, 20)
      });
      if (departureCityInput?.value.trim()) {
        params.set('departure_city', departureCityInput.value.trim().slice(0, 120));
      }
      window.location.href = `booking.html?${params.toString()}`;
    });
  }

  updateCalculatorDisplay();
}

function updateBookingEstimate() {
  const destinationSelect = document.getElementById('booking-destination');
  const adultsInput = document.getElementById('adults');
  const childrenInput = document.getElementById('children');
  const nightsInput = document.getElementById('nights');
  const travellersInput = document.getElementById('travellers');
  const estimatedInput = document.getElementById('estimated-total');
  const travelModeField = document.getElementById('travel-mode-field');
  const travelModeNote = document.getElementById('travel-mode-note');
  const travelModeHidden = document.getElementById('travel-mode');
  const travelModeTrain = document.getElementById('travel-mode-train');
  const summaryPackage = document.getElementById('booking-summary-package');
  const summaryDuration = document.getElementById('booking-summary-duration');
  const summaryPrice = document.getElementById('booking-summary-price');
  const summaryTravellers = document.getElementById('booking-summary-travellers');
  const summaryMode = document.getElementById('booking-summary-mode');
  const summaryTransport = document.getElementById('booking-summary-transport');
  const summaryTotal = document.getElementById('booking-summary-total');

  if (!destinationSelect || !adultsInput || !childrenInput || !nightsInput || !travellersInput || !estimatedInput) return;

  const selectedPackage = getPackageByName(destinationSelect.value);
  if (!selectedPackage) {
    return;
  }

  const travelModeRadioGroup = document.querySelectorAll('input[name="travel_mode_choice"]');
  if (isDomesticPackage(selectedPackage)) {
    if (travelModeRadioGroup.length && !document.querySelector('input[name="travel_mode_choice"]:checked')) {
      travelModeRadioGroup[0].checked = true;
    }
  } else {
    travelModeRadioGroup.forEach((choice) => { choice.checked = false; });
  }
  const selectedTravelMode = isDomesticPackage(selectedPackage)
    ? (document.querySelector('input[name="travel_mode_choice"]:checked')?.value || 'Train')
    : '';
  if (travelModeField) travelModeField.hidden = !isDomesticPackage(selectedPackage);
  if (travelModeHidden) travelModeHidden.value = selectedTravelMode;
  setTextValue('booking-summary-category', selectedPackage.category);
  setTextValue('booking-summary-mode', selectedTravelMode || 'Not applicable');
  setTextValue('booking-summary-transport', isDomesticPackage(selectedPackage) ? 'Additional, requires separate confirmation' : 'Not applicable');
  updateDepartureLocationControls(selectedPackage, selectedTravelMode);
  if (travelModeNote) {
    travelModeNote.textContent = isDomesticPackage(selectedPackage)
      ? 'Choose either train or flight for this domestic package. Transport fare is additional and requires separate confirmation.'
      : 'International bookings continue without the domestic train or flight selector.';
  }

  const adultsState = getEditableNumberState(adultsInput, 1, 20);
  const childrenState = getEditableNumberState(childrenInput, 0, 20);
  const nightsState = getEditableNumberState(nightsInput, 1, 30);

  if (!adultsState.isValid || !childrenState.isValid || !nightsState.isValid) {
    travellersInput.value = '';
    estimatedInput.value = '';
    setTextValue('booking-summary-package', '');
    setTextValue('booking-summary-duration', '');
    setTextValue('booking-summary-price', '₹0');
    setTextValue('booking-summary-price-table', '₹0');
    setTextValue('booking-summary-travellers', '0');
    setTextValue('booking-summary-mode', '');
    setTextValue('booking-summary-transport', '');
    setTextValue('booking-summary-total', '₹0');
    return;
  }

  let adults = adultsState.value;
  let children = childrenState.value;
  let nights = nightsState.value;
  const totalTravellers = adults + children;
  if (totalTravellers > 20) {
    travellersInput.value = '';
    estimatedInput.value = '';
    setFieldValue('estimated-total-value', '');
    setTextValue('booking-summary-travellers', '—');
    setTextValue('booking-summary-total', '—');
    return;
  }

  adultsInput.value = adults;
  childrenInput.value = children;
  nightsInput.value = selectedPackage.nights;
  travellersInput.value = totalTravellers;

  const packagePrice = Number(selectedPackage.price) || 0;
  const estimatedTotal = packagePrice * totalTravellers;
  if (travelModeTrain) travelModeTrain.checked = selectedTravelMode === 'Train';
  const flightChoice = document.getElementById('travel-mode-flight');
  if (flightChoice) flightChoice.checked = selectedTravelMode === 'Flight';

  setFieldValue('package-duration', selectedPackage.duration);
  setFieldValue('package-price', String(packagePrice));
  setFieldValue('package-category', selectedPackage.category);
  setFieldValue('estimated-total-value', String(estimatedTotal));

  setTextValue('booking-summary-package', selectedPackage.name);
  setTextValue('booking-summary-duration', selectedPackage.duration);
  setTextValue('booking-summary-price', formatINR(packagePrice));
  setTextValue('booking-summary-price-table', formatINR(packagePrice));
  setTextValue('booking-summary-travellers', String(totalTravellers));
  setTextValue('booking-summary-mode', isDomesticPackage(selectedPackage) ? selectedTravelMode : 'Not applicable');
  setTextValue('booking-summary-transport', isDomesticPackage(selectedPackage) ? 'Additional, requires separate confirmation' : 'Not applicable');
  setTextValue('booking-summary-total', formatINR(estimatedTotal));

  estimatedInput.value = formatINR(estimatedTotal).replace(/\s/g, '');
}

function initializeBookingForm() {
  const destinationSelect = document.getElementById('booking-destination');
  const adultsInput = document.getElementById('adults');
  const childrenInput = document.getElementById('children');
  const nightsInput = document.getElementById('nights');
  const travellersInput = document.getElementById('travellers');
  const travelDateInput = document.getElementById('travel-date');
  const departureCityInput = document.getElementById('departure-city');
  const departureLocationInput = document.getElementById('departure-location');
  const travelModeField = document.getElementById('travel-mode-field');
  const travelModeChoices = document.querySelectorAll('input[name="travel_mode_choice"]');
  const form = document.getElementById('booking-form');

  if (!destinationSelect || !adultsInput || !childrenInput || !nightsInput || !travellersInput) return;

  const params = new URLSearchParams(window.location.search);
  const selectedDestination = params.get('destination') || 'Goa Beach Holiday';
  const travellerCount = clampNumber(params.get('travellers'), 1, 1, 20);
  const adults = clampNumber(params.get('adults'), travellerCount, 1, 20);
  const children = clampNumber(params.get('children'), 0, 0, 20);

  populateDestinationOptions(destinationSelect, selectedDestination);
  adultsInput.value = String(adults);
  childrenInput.value = String(children);
  travellersInput.value = String(adults + children);
  if (departureCityInput && params.get('departure_city')) {
    departureCityInput.value = params.get('departure_city').slice(0, 120);
  }
  if (departureLocationInput && params.get('departure_location')) {
    departureLocationInput.value = params.get('departure_location').slice(0, 180);
  }
  if (travelDateInput) {
    travelDateInput.min = getTodayISODate();
  }

  travelModeChoices.forEach((choice) => {
    choice.addEventListener('change', () => {
      const selectedPackage = getPackageByName(destinationSelect.value);
      if (selectedPackage && isDomesticPackage(selectedPackage)) {
        const departureLocationInput = document.getElementById('departure-location');
        if (departureLocationInput) {
          departureLocationInput.value = '';
          departureLocationInput.dataset.suggestedValue = '';
        }
        setFieldValue('travel-mode', choice.value);
        updateBookingEstimate();
      }
    });
  });

  destinationSelect.addEventListener('change', updateBookingEstimate);
  adultsInput.addEventListener('input', updateBookingEstimate);
  childrenInput.addEventListener('input', updateBookingEstimate);
  nightsInput.addEventListener('input', updateBookingEstimate);
  if (travelModeField) {
    travelModeField.addEventListener('change', updateBookingEstimate);
  }
  if (departureCityInput) {
    departureCityInput.addEventListener('input', () => {
      updateDepartureSuggestions();
      updateBookingEstimate();
    });
  }
  if (departureLocationInput) {
    departureLocationInput.addEventListener('input', updateBookingEstimate);
  }
  document.addEventListener('wheel', (event) => {
    if (event.target instanceof HTMLElement && event.target.matches('input[type="number"]')) {
      event.preventDefault();
    }
  }, { passive: false });

  const initialPackage = getPackageByName(destinationSelect.value);
  if (initialPackage) {
    nightsInput.value = String(initialPackage.nights);
  }
  updateBookingEstimate();

  if (form) {
    form.addEventListener('submit', (event) => {
      const name = document.getElementById('full-name').value.trim();
      const email = document.getElementById('email').value.trim();
      const phone = document.getElementById('phone').value.trim();
      const travelDate = document.getElementById('travel-date').value;
      const destination = destinationSelect.value;
      const selectedPackage = getPackageByName(destination);
      const adultsCount = Number(adultsInput.value) || 0;
      const childrenCount = Number(childrenInput.value) || 0;
      const nightsCount = Number(nightsInput.value) || 0;
      const travellersCount = Number(travellersInput.value) || 0;
      const travelMode = document.getElementById('travel-mode').value;
      const packagePrice = Number(document.getElementById('package-price').value) || 0;
      const packageDuration = document.getElementById('package-duration').value;
      const packageCategory = document.getElementById('package-category').value;

      if (!name || !email || !phone || !travelDate || !destination) {
        event.preventDefault();
        alert('Please complete all required booking details before submitting.');
        return;
      }

      if (!selectedPackage) {
        event.preventDefault();
        alert('Please select a valid package before submitting.');
        return;
      }

      if (adultsCount < 1 || adultsCount > 20 || childrenCount < 0 || childrenCount > 20 || nightsCount < 1 || nightsCount > 30 || travellersCount < 1 || travellersCount > 20) {
        event.preventDefault();
        alert('Please enter valid traveller and trip details before submitting.');
        return;
      }

      if (selectedPackage.nights !== nightsCount) {
        event.preventDefault();
        alert('The selected package duration has changed. Please review the package details and try again.');
        return;
      }

      if (selectedPackage.price !== packagePrice || selectedPackage.duration !== packageDuration || selectedPackage.category !== packageCategory) {
        event.preventDefault();
        alert('The selected package details are out of sync. Please reselect the package and try again.');
        return;
      }

      if (isDomesticPackage(selectedPackage) && !['Train', 'Flight'].includes(travelMode)) {
        event.preventDefault();
        alert('Please select either Train or Flight for this domestic package.');
        return;
      }

      const submitButton = form.querySelector('button[type="submit"]');
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Submitting...';
      }
    });
  }
}

function initializeImageFallbacks() {
  const fallbackImage = 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1200&q=80';
  document.querySelectorAll('.hero-image, .card-image').forEach((image) => {
    if (!(image instanceof HTMLImageElement)) return;
    if (!image.dataset.fallback) {
      image.dataset.fallback = fallbackImage;
    }

    image.addEventListener('error', () => {
      if (image.src !== image.dataset.fallback) {
        image.src = image.dataset.fallback;
      }
    });
  });
}

function initializeNavigation() {
  const navToggle = document.querySelector('.nav-toggle');
  const navLinks = document.querySelector('.nav-links');

  if (navToggle && navLinks) {
    navToggle.setAttribute('aria-expanded', String(navLinks.classList.contains('open')));
    navToggle.addEventListener('click', () => {
      navLinks.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', String(navLinks.classList.contains('open')));
    });
    navToggle.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && navLinks.classList.contains('open')) {
        navLinks.classList.remove('open');
        navToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  const currentPage = window.location.pathname.split('/').pop();
  document.querySelectorAll('.nav-links a').forEach((link) => {
    const href = link.getAttribute('href');
    if (href === currentPage) {
      link.classList.add('active');
    }
  });
}

function initializeFormSecurity() {
  document.querySelectorAll('form[action^="php/process-"]').forEach((form) => {
    const tokenInput = form.querySelector('input[name="csrf_token"]');
    const submitButton = form.querySelector('button[type="submit"]');
    if (!tokenInput) return;

    if (submitButton) submitButton.disabled = true;
    form.addEventListener('submit', (event) => {
      if (!tokenInput.value) {
        event.preventDefault();
        alert('Form security could not be initialized. Reload the page and try again.');
      }
    }, true);

    fetch('php/form-token.php', { credentials: 'same-origin', cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error('Could not initialize form security.');
        return response.json();
      })
      .then((result) => {
        if (typeof result.token !== 'string' || !result.token) throw new Error('Invalid form security token.');
        tokenInput.value = result.token;
      })
      .catch((error) => console.error(error))
      .finally(() => {
        if (submitButton) submitButton.disabled = false;
      });
  });
}

function initializeGallery() {
  const galleryItems = document.querySelectorAll('.gallery-item');
  const lightbox = document.querySelector('.lightbox');
  const lightboxImage = document.querySelector('.lightbox-content img');
  const closeBtn = document.querySelector('.lightbox-close');

  if (!lightbox || !lightboxImage) return;
  let activeGalleryItem = null;

  const closeLightbox = () => {
    lightbox.classList.remove('active');
    activeGalleryItem?.focus();
  };

  galleryItems.forEach((item) => {
    const image = item.querySelector('img');
    const rawImages = item.dataset.images ? JSON.parse(item.dataset.images) : [];
    const images = Array.isArray(rawImages) && rawImages.length ? rawImages : [image ? image.src : ''];
    const originalImage = image ? image.src : images[0];
    let currentIndex = 0;
    let slideshowTimer = null;

    const setImage = (index) => {
      currentIndex = index;
      if (!image) return;
      image.src = images[currentIndex] || originalImage;
      image.alt = item.dataset.name || 'Travel gallery image';
    };

    const startSlideshow = () => {
      if (slideshowTimer) return;
      slideshowTimer = window.setInterval(() => {
        const nextIndex = (currentIndex + 1) % images.length;
        setImage(nextIndex);
      }, 1800);
    };

    const stopSlideshow = () => {
      if (slideshowTimer) {
        window.clearInterval(slideshowTimer);
        slideshowTimer = null;
      }
      if (image) {
        image.src = originalImage;
        image.alt = item.dataset.name || 'Travel gallery image';
      }
    };

    if (image) {
      const fallbackImage = 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=900&q=80';
      image.onerror = () => {
        if (image.src !== fallbackImage) image.src = fallbackImage;
      };
    }

    item.tabIndex = 0;
    item.setAttribute('role', 'button');
    item.setAttribute('aria-label', `Open gallery images for ${item.dataset.name || 'this destination'}`);

    item.addEventListener('mouseenter', startSlideshow);
    item.addEventListener('mouseleave', stopSlideshow);
    const openNextImage = () => {
      const nextIndex = (currentIndex + 1) % images.length;
      setImage(nextIndex);
      if (!image) return;
      activeGalleryItem = item;
      lightboxImage.src = image.src;
      lightboxImage.alt = image.alt || item.dataset.name || 'Expanded gallery view';
      lightbox.classList.add('active');
      closeBtn?.focus();
    };

    item.addEventListener('click', openNextImage);
    item.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openNextImage();
      }
    });
  });

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      closeLightbox();
    });
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && lightbox.classList.contains('active')) closeLightbox();
  });

  lightbox.addEventListener('click', (event) => {
    if (event.target === lightbox) {
      closeLightbox();
    }
  });
}

function initializeFilters() {
  const filterButtons = document.querySelectorAll('.filter-btn');
  const cards = document.querySelectorAll('.destination-card, .package-card');

  if (!filterButtons.length || !cards.length) return;

  filterButtons.forEach((button) => {
    button.addEventListener('click', () => {
      filterButtons.forEach((btn) => btn.classList.remove('active'));
      button.classList.add('active');

      const selectedFilter = button.dataset.filter;
      cards.forEach((card) => {
        const cardCategory = card.dataset.category;
        if (selectedFilter === 'all' || cardCategory === selectedFilter) {
          card.classList.remove('hidden');
        } else {
          card.classList.add('hidden');
        }
      });
    });
  });
}

function showPackageDataError() {
  let message = document.getElementById('package-data-error');
  if (!message) {
    const main = document.querySelector('main');
    if (!main) return;
    message = document.createElement('p');
    message.id = 'package-data-error';
    message.className = 'message-box error';
    message.setAttribute('role', 'alert');
    main.prepend(message);
  }
  message.textContent = 'Travel package information could not be loaded. Refresh the page or contact the site administrator.';
  message.hidden = false;
  const submitButton = document.querySelector('#booking-form button[type="submit"]');
  if (submitButton) submitButton.disabled = true;
  const calculatorButton = document.getElementById('calculator-book');
  if (calculatorButton) calculatorButton.disabled = true;
}

document.addEventListener('DOMContentLoaded', async () => {
  initializeNavigation();
  initializeFormSecurity();
  initializeGallery();
  initializeImageFallbacks();
  try {
    await loadTravelPackages();
    populateDepartureCityLists();
    updatePackageCards();
    initializePackageDeparture();
    initializeCalculator();
    initializeBookingForm();
    initializeFilters();
  } catch (error) {
    console.error(error);
    showPackageDataError();
  }
});
