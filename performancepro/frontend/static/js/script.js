// Global variables
let currentUser = null;
let currentPage = 'dashboard';
let selectedRating = 0;
let allEmployees = []; // Store all employees for validation
let chartInstances = {}; // Store chart instances to destroy them later

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    // Show welcome page for 2.5 seconds, then show login page
    setTimeout(() => {
        const welcomePage = document.getElementById('welcomePage');
        welcomePage.classList.add('fade-out');
        
        setTimeout(() => {
            welcomePage.style.display = 'none';
            document.getElementById('loginPage').style.display = 'flex';
        }, 500);
    }, 2500);

    // Check if user is already logged in
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        showDashboard();
    }

    // Login form handler
    document.getElementById('loginForm').addEventListener('submit', handleLogin);

    // Signup form handler
    document.getElementById('signupForm').addEventListener('submit', handleSignup);

    // Admin password form handler
    document.getElementById('adminPasswordForm').addEventListener('submit', handleAdminPassword);

    // Add employee form handler
    document.getElementById('addEmployeeForm').addEventListener('submit', handleAddEmployee);

    // Navigation handlers
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function(e) {
            const page = this.getAttribute('data-page');
            if (page && page !== 'admin') {
                e.preventDefault();
                navigateToPage(page);
            }
        });
    });

    // Search functionality
    document.getElementById('searchEmployees').addEventListener('input', filterEmployees);
    document.getElementById('searchAdminEmployees').addEventListener('input', filterAdminEmployees);

    // Customer rating form handler
    document.getElementById('customerRatingForm').addEventListener('submit', handleCustomerRatingSubmit);

    // Star rating handlers
    document.querySelectorAll('#customerStarRating .star').forEach(star => {
        star.addEventListener('click', function() {
            selectedRating = parseInt(this.getAttribute('data-rating'));
            updateStarDisplay(selectedRating);
        });

        star.addEventListener('mouseenter', function() {
            const rating = parseInt(this.getAttribute('data-rating'));
            updateStarDisplay(rating);
        });
    });

    document.getElementById('customerStarRating').addEventListener('mouseleave', function() {
        updateStarDisplay(selectedRating);
    });

    // Add email validation to employee email field
    const employeeEmailField = document.getElementById('employeeEmail');
    if (employeeEmailField) {
        employeeEmailField.addEventListener('blur', validateEmployeeEmail);
    }
});

// API Helper Functions
async function apiRequest(endpoint, method = 'GET', data = null) {
    const options = {
        method: method,
        headers: {
            'Content-Type': 'application/json'
        }
    };
    
    if (data && (method === 'POST' || method === 'PUT')) {
        options.body = JSON.stringify(data);
    }
    
    try {
        console.log(`Making API request to: ${endpoint}`, options);
        const response = await fetch(endpoint, options);
        
        console.log(`Response status: ${response.status}`);
        
        // Check if the response is JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            // If not JSON, get the text and throw an error
            const text = await response.text();
            console.error('Response is not JSON. Content-Type:', contentType);
            console.error('Response text:', text);
            throw new Error(`Server returned non-JSON response. Status: ${response.status}. Please check if the backend is running.`);
        }
        
        const result = await response.json();
        
        if (!response.ok) {
            // Handle admin access required error specifically
            if (response.status === 403 && result.error === 'Admin access required') {
                // Redirect to customer ratings if user is customer
                if (currentUser && currentUser.role === 'customer') {
                    navigateToPage('customer-ratings');
                }
                throw new Error('Admin access required');
            }
            
            throw new Error(result.error || `API request failed with status ${response.status}`);
        }
        
        return result;
    } catch (error) {
        // Only log errors that are not "Admin access required"
        if (error.message !== 'Admin access required') {
            console.error('API Error:', error);
            showToast(error.message, 'error');
        }
        throw error;
    }
}

// Authentication Functions
async function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const role = document.getElementById('role').value.trim();

    console.log('Login data:', { username, role }); // Debug log

    if (!username || !password || !role) {
        showToast('Please fill in all fields', 'error');
        return;
    }

    // Validate role
    if (!['admin', 'customer'].includes(role)) {
        showToast('Invalid role selected', 'error');
        return;
    }

    try {
        console.log('=== LOGIN ATTEMPT ===');
        console.log('Username:', username);
        console.log('Role:', role);
        
        const result = await apiRequest('/api/login', 'POST', {
            username: username,
            password: password,
            role: role
        });
        
        console.log('Login response:', result);
        
        if (result.success) {
            currentUser = result.user;
            console.log('Current user set to:', currentUser);
            console.log('Current user details:', JSON.stringify(currentUser));
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            showToast('Login successful!', 'success');
            showDashboard();
        }
    } catch (error) {
        console.error('=== LOGIN FAILED ===');
        console.error('Error message:', error.message);
        
        // Additional troubleshooting information
        if (error.message.includes('401')) {
            showToast('Invalid username or password. Please check your credentials.', 'error');
            console.log('Possible causes:');
            console.log('1. Username does not exist in the database');
            console.log('2. Password is incorrect');
            console.log('3. User account is disabled or locked');
            console.log('4. Role does not match user role in database');
        } else if (error.message.includes('Failed to fetch')) {
            showToast('Unable to connect to the server. Please check your internet connection.', 'error');
            console.log('Possible causes:');
            console.log('1. Backend server is not running');
            console.log('2. Network connectivity issues');
            console.log('3. Firewall blocking the request');
            console.log('4. Incorrect API endpoint URL');
        } else if (error.message.includes('CORS')) {
            showToast('Cross-origin request blocked. Please contact support.', 'error');
            console.log('Possible causes:');
            console.log('1. Backend not configured for CORS');
            console.log('2. Frontend domain not whitelisted');
        } else if (error.message.includes('Data truncated')) {
            showToast('Invalid role value. Please select a valid role.', 'error');
        } else {
            showToast(error.message, 'error');
        }
    }
}

// Toggle between login and signup forms
function showLoginForm() {
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('signupForm').style.display = 'none';
    document.getElementById('loginTab').classList.add('active');
    document.getElementById('signupTab').classList.remove('active');
}

function showSignupForm() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('signupForm').style.display = 'block';
    document.getElementById('loginTab').classList.remove('active');
    document.getElementById('signupTab').classList.add('active');
}

// Handle signup form submission
async function handleSignup(e) {
    e.preventDefault();
    
    const name = document.getElementById('signupName').value.trim();
    const username = document.getElementById('signupUsername').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const role = document.getElementById('signupRole').value.trim();

    console.log('Signup data:', { name, username, email, role }); // Debug log

    // Validate passwords match
    if (password !== confirmPassword) {
        showToast('Passwords do not match', 'error');
        return;
    }

    // Validate role
    if (!['admin', 'customer'].includes(role)) {
        showToast('Invalid role selected', 'error');
        return;
    }

    try {
        const result = await apiRequest('/api/signup', 'POST', {
            name: name,
            username: username,
            email: email,
            password: password,
            role: role
        });
        
        if (result.success) {
            showToast('Account created successfully! Please login.', 'success');
            showLoginForm();
            document.getElementById('signupForm').reset();
        }
    } catch (error) {
        console.error('Error signing up:', error);
        // Show more specific error message
        if (error.message.includes('Data truncated')) {
            showToast('Invalid role value. Please select a valid role.', 'error');
        } else {
            showToast(error.message, 'error');
        }
    }
}

function logout() {
    apiRequest('/api/logout', 'POST')
        .then(() => {
            localStorage.removeItem('currentUser');
            currentUser = null;
            document.getElementById('dashboard').style.display = 'none';
            document.getElementById('loginPage').style.display = 'flex';
            document.getElementById('loginForm').reset();
            showToast('Logged out successfully', 'info');
        })
        .catch(error => {
            console.error('Logout error:', error);
        });
}

// Dashboard Functions
function showDashboard() {
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';

    // Update user info
    document.getElementById('userName').textContent = `Welcome, ${currentUser.name}`;
    document.getElementById('userAvatar').textContent = currentUser.name.charAt(0).toUpperCase();

    // Show/hide navigation items based on role
    if (currentUser.role === 'admin') {
        // Show all admin navigation items
        document.getElementById('dashboardNav').style.display = 'block';
        document.getElementById('adminNav').style.display = 'block';
        document.getElementById('employeesNav').style.display = 'block';
        document.getElementById('analyticsNav').style.display = 'block';
        document.getElementById('customerRatingsNav').style.display = 'block';
        
        // Set default page to dashboard and load data
        navigateToPage('dashboard');
    } else if (currentUser.role === 'customer') {
        // Hide admin-only navigation items
        document.getElementById('dashboardNav').style.display = 'none';
        document.getElementById('adminNav').style.display = 'none';
        document.getElementById('employeesNav').style.display = 'none';
        document.getElementById('analyticsNav').style.display = 'none';
        document.getElementById('customerRatingsNav').style.display = 'block';
        
        // Set default page to customer ratings
        navigateToPage('customer-ratings');
    }
}

async function loadDashboardData() {
    // Check if user is admin before making the API request
    if (!currentUser || currentUser.role !== 'admin') {
        // Redirect to customer ratings if user is customer
        if (currentUser && currentUser.role === 'customer') {
            navigateToPage('customer-ratings');
        }
        return;
    }

    try {
        const data = await apiRequest('/api/dashboard');
        
        // Update dashboard stats
        document.getElementById('totalEmployees').textContent = data.total_employees;
        document.getElementById('avgCustomerRating').textContent = data.avg_customer_rating;
        document.getElementById('totalReviews').textContent = data.total_reviews;
        document.getElementById('topRated').textContent = data.top_rated;
        
        // Initialize charts
        initializeCharts(data.rating_distribution, data.monthly_ratings);
    } catch (error) {
        // Only log errors that are not "Admin access required"
        if (error.message !== 'Admin access required') {
            console.error('Error loading dashboard data:', error);
        }
    }
}

function initializeCharts(ratingDistribution, monthlyRatings) {
    // Destroy existing charts before creating new ones
    Object.keys(chartInstances).forEach(key => {
        if (chartInstances[key]) {
            chartInstances[key].destroy();
            delete chartInstances[key];
        }
    });

    // Rating Distribution Chart
    const distributionCtx = document.getElementById('ratingDistributionChart');
    if (distributionCtx) {
        chartInstances.distributionChart = new Chart(distributionCtx.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: ['5★', '4★', '3★', '2★', '1★'],
                datasets: [{
                    data: [
                        ratingDistribution.five_star || 0,
                        ratingDistribution.four_star || 0,
                        ratingDistribution.three_star || 0,
                        ratingDistribution.two_star || 0,
                        ratingDistribution.one_star || 0
                    ],
                    backgroundColor: [
                        'rgba(16, 185, 129, 0.8)',
                        'rgba(59, 130, 246, 0.8)',
                        'rgba(245, 158, 11, 0.8)',
                        'rgba(239, 68, 68, 0.8)',
                        'rgba(156, 163, 175, 0.8)'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            boxWidth: 10,
                            padding: 8,
                            font: {
                                size: 9
                            }
                        }
                    }
                }
            }
        });
    }

    // Monthly Ratings Chart
    const monthlyCtx = document.getElementById('monthlyRatingsChart');
    if (monthlyCtx) {
        // Prepare monthly data
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const labels = monthlyRatings.map(item => monthNames[item.month - 1]);
        const ratings = monthlyRatings.map(item => item.avg_rating);
        
        chartInstances.monthlyChart = new Chart(monthlyCtx.getContext('2d'), {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Avg Rating',
                    data: ratings,
                    borderColor: 'rgba(79, 70, 229, 1)',
                    backgroundColor: 'rgba(79, 70, 229, 0.1)',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 5,
                        ticks: {
                            font: {
                                size: 9
                            }
                        }
                    },
                    x: {
                        ticks: {
                            font: {
                                size: 9
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    }
}

// Employee Functions
async function loadEmployees() {
    try {
        // This endpoint is now accessible to both admins and customers
        const employees = await apiRequest('/api/employees');
        allEmployees = employees; // Store for validation
        
        const tbody = document.getElementById('employeeTableBody');
        if (tbody) {
            tbody.innerHTML = "";

            employees.forEach(employee => {
                // Ensure customer_rating is a number
                const customerRating = parseFloat(employee.customer_rating) || 0;
                const reviewCount = parseInt(employee.review_count) || 0;
                
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>
                        <div class="employee-info">
                            <div class="employee-avatar">${employee.avatar}</div>
                            <div>
                                <div style="font-weight: 600;">${employee.name}</div>
                                <div style="font-size: 0.875rem; color: var(--text-secondary);">ID: ${employee.id}</div>
                            </div>
                        </div>
                    </td>
                    <td>${employee.department}</td>
                    <td>${employee.position}</td>
                    <td>
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <div class="rating-stars">
                                ${generateStars(customerRating)}
                            </div>
                            <span class="rating-badge ${getRatingClass(customerRating)}">
                                ${customerRating.toFixed(1)}
                            </span>
                        </div>
                    </td>
                    <td>${reviewCount}</td>
                    <td>
                        <button class="btn" style="padding: 0.5rem 1rem; background-color: var(--primary-color); color: white;" onclick="viewEmployeeDetails(${employee.id})">
                            <i class="fas fa-eye"></i> View
                        </button>
                    </td>
                `;
                tbody.appendChild(row);
            });
        }

        // Populate employee select for rating form
        const employeeSelect = document.getElementById('rateEmployeeSelect');
        if (employeeSelect) {
            employeeSelect.innerHTML = '<option value="">Choose an employee...</option>';
            employees.forEach(employee => {
                const option = document.createElement('option');
                option.value = employee.id;
                option.textContent = `${employee.name} - ${employee.position}`;
                employeeSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading employees:', error);
        showToast('Failed to load employees', 'error');
    }
}

async function loadAdminEmployees() {
    try {
        const employees = await apiRequest('/api/employees');
        allEmployees = employees; // Store for validation
        
        const tbody = document.getElementById('adminEmployeeTableBody');
        if (tbody) {
            tbody.innerHTML = "";

            employees.forEach(employee => {
                // Ensure customer_rating is a number
                const customerRating = parseFloat(employee.customer_rating) || 0;
                const reviewCount = parseInt(employee.review_count) || 0;
                
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>
                        <div class="employee-info">
                            <div class="employee-avatar">${employee.avatar}</div>
                            <div>
                                <div style="font-weight: 600;">${employee.name}</div>
                                <div style="font-size: 0.875rem; color: var(--text-secondary);">${employee.email}</div>
                            </div>
                        </div>
                    </td>
                    <td>${employee.department}</td>
                    <td>${employee.position}</td>
                    <td>
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <div class="rating-stars">
                                ${generateStars(customerRating)}
                            </div>
                            <span class="rating-badge ${getRatingClass(customerRating)}">
                                ${customerRating.toFixed(1)}
                            </span>
                        </div>
                    </td>
                    <td>${reviewCount}</td>
                    <td>
                        <button class="btn" style="padding: 0.5rem 1rem; background-color: var(--info-color); color: white; margin-right: 0.5rem;" onclick="viewEmployeeDetails(${employee.id})">
                            <i class="fas fa-eye"></i> View
                        </button>
                        <button class="btn" style="padding: 0.5rem 1rem; background-color: var(--danger-color); color: white;" onclick="deleteEmployee(${employee.id})">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </td>
                `;
                tbody.appendChild(row);
            });
        }
    } catch (error) {
        console.error('Error loading admin employees:', error);
        showToast('Failed to load admin employees', 'error');
    }
}

async function deleteEmployee(employeeId) {
    if (!confirm('Are you sure you want to delete this employee?')) {
        return;
    }
    
    try {
        await apiRequest(`/api/employees/${employeeId}`, 'DELETE');
        showToast('Employee deleted successfully!', 'success');
        // Refresh all relevant data
        loadAdminEmployees();
        loadEmployees();
        loadDashboardData();
        // If analytics page is currently active, refresh it too
        if (currentPage === 'analytics') {
            initializeAnalyticsCharts();
        }
    } catch (error) {
        console.error('Error deleting employee:', error);
    }
}

// Email validation function
function validateEmployeeEmail() {
    const emailField = document.getElementById('employeeEmail');
    const email = emailField.value.trim();
    
    if (!email) {
        return true; // Let required field validation handle empty email
    }
    
    // Check if email already exists in our local cache
    const emailExists = allEmployees.some(emp => emp.email && emp.email.toLowerCase() === email.toLowerCase());
    
    if (emailExists) {
        emailField.setCustomValidity('This email is already in use by another employee');
        showToast('This email is already in use by another employee', 'error');
        return false;
    } else {
        emailField.setCustomValidity('');
        return true;
    }
}

async function handleAddEmployee(e) {
    e.preventDefault();
    
    const name = document.getElementById('employeeName').value;
    const department = document.getElementById('employeeDepartment').value;
    const position = document.getElementById('employeePosition').value;
    const email = document.getElementById('employeeEmail').value;
    const phone = document.getElementById('employeePhone').value;
    const joinDate = document.getElementById('employeeJoinDate').value;

    // Validate email before submission
    if (!validateEmployeeEmail()) {
        return;
    }

    try {
        const result = await apiRequest('/api/employees', 'POST', {
            name: name,
            department: department,
            position: position,
            email: email,
            phone: phone,
            join_date: joinDate
        });
        
        if (result.success) {
            // Reset form
            document.getElementById('addEmployeeForm').reset();
            
            // Show success message
            showToast('Employee added successfully!', 'success');
            
            // Refresh all relevant data
            loadAdminEmployees();
            loadEmployees();
            loadDashboardData();
            // If analytics page is currently active, refresh it too
            if (currentPage === 'analytics') {
                initializeAnalyticsCharts();
            }
        }
    } catch (error) {
        // Handle specific "Email already exists" error
        if (error.message === 'Email already exists') {
            const emailField = document.getElementById('employeeEmail');
            emailField.setCustomValidity('This email is already in use by another employee');
            emailField.reportValidity();
            showToast('This email is already in use by another employee', 'error');
        } else {
            console.error('Error adding employee:', error);
        }
    }
}

async function viewEmployeeDetails(employeeId) {
    try {
        console.log('Loading employee details for ID:', employeeId);
        const data = await apiRequest(`/api/employees/${employeeId}`);
        const employee = data.employee;
        const reviews = data.reviews;

        console.log('Employee data:', employee);
        console.log('Reviews:', reviews);

        // Ensure customer_rating is a number
        const customerRating = parseFloat(employee.customer_rating) || 0;
        const reviewCount = parseInt(employee.review_count) || 0;

        const modalContent = document.getElementById('employeeModalContent');
        if (modalContent) {
            modalContent.innerHTML = `
                <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 2rem;">
                    <div class="employee-avatar" style="width: 60px; height: 60px; font-size: 1.5rem;">${employee.avatar}</div>
                    <div>
                        <h3 style="margin-bottom: 0.25rem;">${employee.name}</h3>
                        <p style="color: var(--text-secondary); margin: 0;">${employee.position}</p>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; margin-bottom: 2rem;">
                    <div>
                        <label style="color: var(--text-secondary); font-size: 0.875rem;">Department</label>
                        <p style="font-weight: 600;">${employee.department}</p>
                    </div>
                    <div>
                        <label style="color: var(--text-secondary); font-size: 0.875rem;">Email</label>
                        <p style="font-weight: 600;">${employee.email}</p>
                    </div>
                    <div>
                        <label style="color: var(--text-secondary); font-size: 0.875rem;">Phone</label>
                        <p style="font-weight: 600;">${employee.phone || 'N/A'}</p>
                    </div>
                    <div>
                        <label style="color: var(--text-secondary); font-size: 0.875rem;">Join Date</label>
                        <p style="font-weight: 600;">${formatDate(employee.join_date)}</p>
                    </div>
                    <div>
                        <label style="color: var(--text-secondary); font-size: 0.875rem;">Customer Rating</label>
                        <p style="font-weight: 600;">
                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                <div class="rating-stars">
                                    ${generateStars(customerRating)}
                                </div>
                                <span class="rating-badge ${getRatingClass(customerRating)}">
                                    ${customerRating.toFixed(1)}
                                </span>
                            </div>
                        </p>
                    </div>
                    <div>
                        <label style="color: var(--text-secondary); font-size: 0.875rem;">Total Reviews</label>
                        <p style="font-weight: 600;">${reviewCount}</p>
                    </div>
                    <div>
                        <label style="color: var(--text-secondary); font-size: 0.875rem;">Employee ID</label>
                        <p style="font-weight: 600;">#${employee.id}</p>
                    </div>
                </div>

                <h4 style="margin-bottom: 1rem;">Customer Reviews</h4>
                ${reviews.length > 0 ? reviews.map(review => `
                    <div class="customer-review">
                        <div class="review-header">
                            <span class="reviewer-name">${review.customer_name}</span>
                            <span class="review-date">${formatDate(review.date)}</span>
                        </div>
                        <div class="review-rating">
                            ${generateStars(parseFloat(review.rating) || 0)}
                        </div>
                        <p class="review-comment">${review.comment || 'No comment provided.'}</p>
                    </div>
                `).join('') : '<p style="color: var(--text-secondary);">No customer reviews available.</p>'}
            `;

            console.log('Modal content updated, showing modal...');
            showModal('employeeModal');
        } else {
            console.error('Modal content element not found');
            showToast('Error displaying employee details', 'error');
        }
    } catch (error) {
        console.error('Error viewing employee details:', error);
        showToast('Failed to load employee details', 'error');
    }
}

// Customer Rating Functions
async function handleCustomerRatingSubmit(e) {
    e.preventDefault();

    const employeeId = document.getElementById('rateEmployeeSelect').value;
    const customerName = document.getElementById('customerName').value.trim();
    const customerEmail = document.getElementById('customerEmail').value.trim();
    const comment = document.getElementById('customerComment').value;

    if (!employeeId || !selectedRating || !customerName || !customerEmail) {
        showToast('Please fill in all required fields', 'error');
        return;
    }

    try {
        await apiRequest('/api/reviews', 'POST', {
            employee_id: parseInt(employeeId),
            customer_name: customerName,
            customer_email: customerEmail,
            rating: selectedRating,
            comment: comment
        });

        // Reset form
        document.getElementById('customerRatingForm').reset();
        selectedRating = 0;
        updateStarDisplay(0);

        // Close modal
        closeModal('rateEmployeeModal');

        // Show success message
        showToast('Rating submitted successfully!', 'success');

        // Refresh all relevant data
        loadEmployees();
        loadAdminEmployees();
        loadDashboardData();
        loadCustomerRatings();
        // If analytics page is currently active, refresh it too
        if (currentPage === 'analytics') {
            initializeAnalyticsCharts();
        }
    } catch (error) {
        console.error('Error submitting rating:', error);
    }
}

async function loadCustomerRatings() {
    try {
        // This endpoint should now be accessible to both admins and customers
        const employees = await apiRequest('/api/employees');
        const grid = document.getElementById('customerRatingGrid');
        if (grid) {
            grid.innerHTML = "";

            employees.forEach(employee => {
                // Ensure customer_rating is a number
                const customerRating = parseFloat(employee.customer_rating) || 0;
                const reviewCount = parseInt(employee.review_count) || 0;
                
                const card = document.createElement('div');
                card.className = 'employee-rating-card';
                card.innerHTML = `
                    <div class="employee-rating-header">
                        <div class="employee-avatar">${employee.avatar}</div>
                        <div class="employee-rating-info">
                            <h4>${employee.name}</h4>
                            <p>${employee.position}</p>
                        </div>
                    </div>
                    <div class="rating-stars">
                        ${generateStars(customerRating)}
                    </div>
                    <div class="rating-stats">
                        <span class="rating-count">${reviewCount} reviews</span>
                        <span class="rating-badge ${getRatingClass(customerRating)}">${customerRating.toFixed(1)}</span>
                    </div>
                    <button class="rate-btn" onclick="viewEmployeeDetails(${employee.id})">
                        View Details
                    </button>
                `;
                grid.appendChild(card);
            });
        }
        
        // Show rate button only for customers
        const rateBtn = document.getElementById('rateEmployeeBtn');
        if (rateBtn) {
            rateBtn.style.display = currentUser.role === 'customer' ? 'block' : 'none';
        }
    } catch (error) {
        console.error('Error loading customer ratings:', error);
        showToast('Failed to load customer ratings', 'error');
    }
}

// Analytics Functions
async function initializeAnalyticsCharts() {
    try {
        // Check if user is admin before making the API request
        if (!currentUser || currentUser.role !== 'admin') {
            // Redirect to customer ratings if user is customer
            if (currentUser && currentUser.role === 'customer') {
                navigateToPage('customer-ratings');
            }
            return;
        }

        // Destroy existing analytics charts before creating new ones
        const analyticsCharts = ['deptRatingsChart', 'performanceTrendChart', 'ratingCategoriesChart', 'topPerformersChart'];
        analyticsCharts.forEach(chartId => {
            if (chartInstances[chartId]) {
                chartInstances[chartId].destroy();
                delete chartInstances[chartId];
            }
        });

        const data = await apiRequest('/api/analytics');
        
        // Department Ratings Chart
        const deptCtx = document.getElementById('deptRatingsChart');
        if (deptCtx) {
            chartInstances.deptRatingsChart = new Chart(deptCtx.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: data.department_ratings.map(item => item.department),
                    datasets: [{
                        label: 'Average Rating',
                        data: data.department_ratings.map(item => parseFloat(item.avg_rating) || 0),
                        backgroundColor: 'rgba(79, 70, 229, 0.8)'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 5,
                            ticks: {
                                font: {
                                    size: 10
                                }
                            }
                        },
                        x: {
                            ticks: {
                                font: {
                                    size: 10
                                }
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: false
                        }
                    }
                }
            });
        }

        // Performance Trend Chart
        const trendCtx = document.getElementById('performanceTrendChart');
        if (trendCtx) {
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const labels = data.performance_trend.map(item => monthNames[item.month - 1]);
            
            chartInstances.performanceTrendChart = new Chart(trendCtx.getContext('2d'), {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Average Rating',
                        data: data.performance_trend.map(item => parseFloat(item.avg_rating) || 0),
                        borderColor: 'rgba(16, 185, 129, 1)',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 5,
                            ticks: {
                                font: {
                                    size: 10
                                }
                            }
                        },
                        x: {
                            ticks: {
                                font: {
                                    size: 10
                                }
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: false
                        }
                    }
                }
            });
        }

        // Rating Categories Chart
        const categoriesCtx = document.getElementById('ratingCategoriesChart');
        if (categoriesCtx) {
            chartInstances.ratingCategoriesChart = new Chart(categoriesCtx.getContext('2d'), {
                type: 'radar',
                data: {
                    labels: data.rating_categories.map(item => item.category),
                    datasets: [{
                        label: 'Company Average',
                        data: data.rating_categories.map(item => parseFloat(item.rating) || 0),
                        borderColor: 'rgba(79, 70, 229, 1)',
                        backgroundColor: 'rgba(79, 70, 229, 0.2)'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        r: {
                            beginAtZero: true,
                            max: 5,
                            ticks: {
                                display: false,
                                stepSize: 1
                            },
                            pointLabels: {
                                font: {
                                    size: 10
                                }
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: false
                        }
                    }
                }
            });
        }

        // Top Performers Chart
        const topCtx = document.getElementById('topPerformersChart');
        if (topCtx) {
            chartInstances.topPerformersChart = new Chart(topCtx.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: data.top_performers.map(emp => emp.name.split(' ')[0]),
                    datasets: [{
                        label: 'Rating',
                        data: data.top_performers.map(emp => parseFloat(emp.customer_rating) || 0),
                        backgroundColor: 'rgba(16, 185, 129, 0.8)'
                    }]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            beginAtZero: true,
                            max: 5,
                            ticks: {
                                font: {
                                    size: 10
                                }
                            }
                        },
                        y: {
                            ticks: {
                                font: {
                                    size: 10
                                }
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: false
                        }
                    }
                }
            });
        }
    } catch (error) {
        // Only log errors that are not "Admin access required"
        if (error.message !== 'Admin access required') {
            console.error('Error initializing analytics charts:', error);
        }
    }
}

// UI Helper Functions
function showAdminPasswordModal(e) {
    e.preventDefault();
    showModal('adminPasswordModal');
}

function handleAdminPassword(e) {
    e.preventDefault();
    
    const password = document.getElementById('adminPassword').value;
    
    // Simple password check (in real app, this would be server-side)
    if (password === 'admin123') {
        closeModal('adminPasswordModal');
        navigateToPage('admin');
        document.getElementById('adminPassword').value = '';
    } else {
        showToast('Incorrect password!', 'error');
    }
}

function navigateToPage(page) {
    // Hide all content
    document.getElementById('dashboardContent').style.display = 'none';
    document.getElementById('adminContent').style.display = 'none';
    document.getElementById('employeesContent').style.display = 'none';
    document.getElementById('analyticsContent').style.display = 'none';
    document.getElementById('customerRatingsContent').style.display = 'none';

    // Update active nav item
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    const activeNavItem = document.querySelector(`[data-page="${page}"]`);
    if (activeNavItem) {
        activeNavItem.classList.add('active');
    }

    // Show selected content
    currentPage = page;
    switch(page) {
        case 'dashboard':
            // Check if user is admin before loading dashboard
            if (currentUser && currentUser.role === 'admin') {
                document.getElementById('pageTitle').textContent = 'Dashboard';
                document.getElementById('dashboardContent').style.display = 'block';
                loadDashboardData();
            } else {
                // If not admin, redirect to customer ratings
                navigateToPage('customer-ratings');
                return;
            }
            break;
        case 'admin':
            // Check if user is admin before loading admin panel
            if (currentUser && currentUser.role === 'admin') {
                document.getElementById('pageTitle').textContent = 'Admin Panel';
                document.getElementById('adminContent').style.display = 'block';
                loadAdminEmployees();
            } else {
                // If not admin, redirect to customer ratings
                navigateToPage('customer-ratings');
                return;
            }
            break;
        case 'employees':
            document.getElementById('pageTitle').textContent = 'Employee Directory';
            document.getElementById('employeesContent').style.display = 'block';
            loadEmployees();
            break;
        case 'analytics':
            // Check if user is admin before loading analytics
            if (currentUser && currentUser.role === 'admin') {
                document.getElementById('pageTitle').textContent = 'Analytics';
                document.getElementById('analyticsContent').style.display = 'block';
                initializeAnalyticsCharts();
            } else {
                // If not admin, redirect to customer ratings
                navigateToPage('customer-ratings');
                return;
            }
            break;
        case 'customer-ratings':
            document.getElementById('pageTitle').textContent = 'Customer Ratings';
            document.getElementById('customerRatingsContent').style.display = 'block';
            loadCustomerRatings();
            break;
    }
}

function switchAdminTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    event.target.classList.add('active');

    // Update content
    document.querySelectorAll('.admin-content').forEach(content => {
        content.classList.remove('active');
    });

    if (tabName === 'employeeList') {
        document.getElementById('adminEmployeeList').classList.add('active');
        loadAdminEmployees(); // Refresh data when switching to employee list
    } else if (tabName === 'addEmployee') {
        document.getElementById('adminAddEmployee').classList.add('active');
    }
}

function filterEmployees() {
    const searchTerm = document.getElementById('searchEmployees').value.toLowerCase();
    const rows = document.querySelectorAll('#employeeTableBody tr');

    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? '' : 'none';
    });
}

function filterAdminEmployees() {
    const searchTerm = document.getElementById('searchAdminEmployees').value.toLowerCase();
    const rows = document.querySelectorAll('#adminEmployeeTableBody tr');

    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? '' : 'none';
    });
}

function showRateEmployeeModal() {
    // Refresh employee list before showing modal
    loadEmployees();
    showModal('rateEmployeeModal');
}

function updateStarDisplay(rating) {
    document.querySelectorAll('#customerStarRating .star').forEach((star, index) => {
        if (index < rating) {
            star.classList.add('active');
        } else {
            star.classList.remove('active');
        }
    });
}

function generateStars(rating) {
    let stars = '';
    for (let i = 1; i <= 5; i++) {
        if (i <= rating) {
            stars += '<i class="fas fa-star star" style="color: #fbbf24;"></i>';
        } else if (i - 0.5 <= rating) {
            stars += '<i class="fas fa-star-half-alt star" style="color: #fbbf24;"></i>';
        } else {
            stars += '<i class="far fa-star star" style="color: #ddd;"></i>';
        }
    }
    return stars;
}

function getRatingClass(rating) {
    if (rating >= 4.5) return 'rating-excellent';
    if (rating >= 3.5) return 'rating-good';
    if (rating >= 2.5) return 'rating-average';
    return 'rating-poor';
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    
    if (toast && toastMessage) {
        toast.className = `toast ${type}`;
        toastMessage.textContent = message;
        
        toast.classList.add('show');
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
}

// Close modal when clicking outside
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.classList.remove('active');
    }
}