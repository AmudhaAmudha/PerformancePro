from flask import Flask, jsonify, request, session, send_from_directory
from flask_cors import CORS
import pymysql
import bcrypt
from datetime import datetime
import os
from functools import wraps
from decimal import Decimal  # Add this import

app = Flask(__name__, static_folder='../frontend/static', static_url_path='/static')
app.secret_key = os.urandom(24)
CORS(app)

# Database configuration
db_config = {
    'host': 'localhost',
    'user': 'root',
    'password': 'root@123',
    'database': 'employee_pro',
    'cursorclass': pymysql.cursors.DictCursor
}

# Helper function to convert Decimal objects to float for JSON serialization
def convert_decimal_to_float(obj):
    if isinstance(obj, dict):
        return {k: convert_decimal_to_float(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_decimal_to_float(item) for item in obj]
    elif isinstance(obj, Decimal):
        return float(obj)
    else:
        return obj

# Error handlers
@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500

# Helper function to connect to database
def get_db_connection():
    return pymysql.connect(**db_config)

# Authentication middleware
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required'}), 401
        return f(*args, **kwargs)
    return decorated_function

def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session or session.get('role') != 'admin':
            return jsonify({'error': 'Admin access required'}), 403
        return f(*args, **kwargs)
    return decorated_function

def customer_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session or session.get('role') != 'customer':
            return jsonify({'error': 'Customer access required'}), 403
        return f(*args, **kwargs)
    return decorated_function

# Routes
@app.route('/')
def index():
    return send_from_directory('../frontend/templates', 'index.html')

@app.route('/api/login', methods=['POST'])
def login():
    try:
        data = request.json
        username = data.get('username', '').strip()
        password = data.get('password', '')
        role = data.get('role', '').strip()
        
        if not username or not password or not role:
            return jsonify({'error': 'Username, password, and role are required'}), 400
        
        connection = get_db_connection()
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT * FROM users WHERE username = %s", (username,))
                user = cursor.fetchone()
                
                if user and bcrypt.checkpw(password.encode('utf-8'), user['password'].encode('utf-8')):
                    # Validate role (case-insensitive comparison)
                    user_role = user['role'].strip().lower()
                    if user_role not in ['admin', 'customer']:
                        return jsonify({'error': 'Invalid role. Only admin and customer roles are allowed.'}), 403
                    
                    # Check if requested role matches user's role
                    if role.lower() != user_role:
                        return jsonify({'error': 'Selected role does not match your account role.'}), 403
                    
                    session['user_id'] = user['id']
                    session['username'] = user['username']
                    session['role'] = user_role
                    session['name'] = user['name']
                    
                    return jsonify({
                        'success': True,
                        'user': {
                            'id': user['id'],
                            'username': user['username'],
                            'role': user_role,
                            'name': user['name']
                        }
                    })
                else:
                    return jsonify({'error': 'Invalid username or password'}), 401
        finally:
            connection.close()
    except Exception as e:
        return jsonify({'error': f'Database error: {str(e)}'}), 500

@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'success': True})

@app.route('/api/dashboard', methods=['GET'])
@login_required
@admin_required
def get_dashboard_data():
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            # Get total employees
            cursor.execute("SELECT COUNT(*) as count FROM employees")
            total_employees = cursor.fetchone()['count']
            
            # Get average customer rating
            cursor.execute("SELECT AVG(customer_rating) as avg_rating FROM employees WHERE review_count > 0")
            avg_rating = cursor.fetchone()['avg_rating'] or 0
            
            # Get total reviews
            cursor.execute("SELECT SUM(review_count) as total FROM employees")
            total_reviews = cursor.fetchone()['total'] or 0
            
            # Get top rated employees (rating >= 4.5)
            cursor.execute("SELECT COUNT(*) as count FROM employees WHERE customer_rating >= 4.5")
            top_rated = cursor.fetchone()['count']
            
            # Get rating distribution
            cursor.execute("""
                SELECT 
                    SUM(CASE WHEN customer_rating >= 4.5 THEN 1 ELSE 0 END) as five_star,
                    SUM(CASE WHEN customer_rating >= 3.5 AND customer_rating < 4.5 THEN 1 ELSE 0 END) as four_star,
                    SUM(CASE WHEN customer_rating >= 2.5 AND customer_rating < 3.5 THEN 1 ELSE 0 END) as three_star,
                    SUM(CASE WHEN customer_rating >= 1.5 AND customer_rating < 2.5 THEN 1 ELSE 0 END) as two_star,
                    SUM(CASE WHEN customer_rating < 1.5 THEN 1 ELSE 0 END) as one_star
                FROM employees
            """)
            rating_distribution = cursor.fetchone()
            
            # Get monthly ratings (last 6 months)
            cursor.execute("""
                SELECT 
                    MONTH(date) as month,
                    AVG(rating) as avg_rating
                FROM customer_reviews
                WHERE date >= DATE_SUB(CURRENT_DATE, INTERVAL 6 MONTH)
                GROUP BY MONTH(date)
                ORDER BY month
            """)
            monthly_ratings = cursor.fetchall()
            
            # Convert Decimal values to float before returning JSON
            dashboard_data = {
                'total_employees': total_employees,
                'avg_customer_rating': round(float(avg_rating), 1) if avg_rating else 0,
                'total_reviews': total_reviews,
                'top_rated': top_rated,
                'rating_distribution': convert_decimal_to_float(rating_distribution),
                'monthly_ratings': convert_decimal_to_float(monthly_ratings)
            }
            
            return jsonify(dashboard_data)
    finally:
        connection.close()

@app.route('/api/employees', methods=['GET'])
@login_required
def get_employees():
    # Changed from @admin_required to @login_required to allow both admins and customers
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT e.*, d.name as department_name
                FROM employees e
                JOIN departments d ON e.department = d.name
            """)
            employees = cursor.fetchall()
            
            # Format avatar for each employee
            for emp in employees:
                if not emp['avatar']:
                    # Generate avatar initials from name
                    name_parts = emp['name'].split()
                    emp['avatar'] = ''.join([part[0].upper() for part in name_parts[:2]])
            
            # Convert Decimal values to float before returning JSON
            employees = convert_decimal_to_float(employees)
            
            return jsonify(employees)
    finally:
        connection.close()

@app.route('/api/employees/<int:employee_id>', methods=['GET'])
@login_required
def get_employee_details(employee_id):
    # Changed from no decorator to @login_required to allow both admins and customers
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            # Get employee details
            cursor.execute("""
                SELECT e.*, d.name as department_name
                FROM employees e
                JOIN departments d ON e.department = d.name
                WHERE e.id = %s
            """, (employee_id,))
            employee = cursor.fetchone()
            
            if not employee:
                return jsonify({'error': 'Employee not found'}), 404
            
            # Generate avatar if not exists
            if not employee['avatar']:
                name_parts = employee['name'].split()
                employee['avatar'] = ''.join([part[0].upper() for part in name_parts[:2]])
            
            # Get customer reviews for this employee
            cursor.execute("""
                SELECT * FROM customer_reviews
                WHERE employee_id = %s
                ORDER BY date DESC
            """, (employee_id,))
            reviews = cursor.fetchall()
            
            # Convert Decimal values to float before returning JSON
            employee_data = {
                'employee': convert_decimal_to_float(employee),
                'reviews': convert_decimal_to_float(reviews)
            }
            
            return jsonify(employee_data)
    finally:
        connection.close()

@app.route('/api/employees', methods=['POST'])
@login_required
@admin_required
def add_employee():
    try:
        data = request.json
        
        # Validate required fields
        required_fields = ['name', 'department', 'position', 'email', 'join_date']
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({'error': f'{field} is required'}), 400
        
        # Generate avatar initials
        name_parts = data['name'].split()
        avatar = ''.join([part[0].upper() for part in name_parts[:2]])
        
        connection = get_db_connection()
        try:
            with connection.cursor() as cursor:
                # Check if email already exists
                cursor.execute("SELECT id FROM employees WHERE email = %s", (data['email'],))
                if cursor.fetchone():
                    return jsonify({'error': 'Email already exists'}), 400
                
                # Insert new employee
                cursor.execute("""
                    INSERT INTO employees 
                    (name, department, position, email, phone, join_date, avatar)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                """, (
                    data['name'],
                    data['department'],
                    data['position'],
                    data['email'],
                    data.get('phone', ''),
                    data['join_date'],
                    avatar
                ))
                
                employee_id = cursor.lastrowid
                connection.commit()
                
                # Get the newly created employee
                cursor.execute("""
                    SELECT e.*, d.name as department_name
                    FROM employees e
                    JOIN departments d ON e.department = d.name
                    WHERE e.id = %s
                """, (employee_id,))
                new_employee = cursor.fetchone()
                
                # Convert Decimal values to float before returning JSON
                new_employee = convert_decimal_to_float(new_employee)
                
                return jsonify({
                    'success': True,
                    'employee': new_employee
                })
        except pymysql.MySQLError as e:
            connection.rollback()
            return jsonify({'error': str(e)}), 500
        finally:
            connection.close()
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/employees/<int:employee_id>', methods=['DELETE'])
@login_required
@admin_required
def delete_employee(employee_id):
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            # Check if employee exists
            cursor.execute("SELECT id FROM employees WHERE id = %s", (employee_id,))
            if not cursor.fetchone():
                return jsonify({'error': 'Employee not found'}), 404
            
            # Delete employee (cascade will delete reviews)
            cursor.execute("DELETE FROM employees WHERE id = %s", (employee_id,))
            connection.commit()
            
            return jsonify({'success': True})
    except pymysql.MySQLError as e:
        connection.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        connection.close()

@app.route('/api/reviews', methods=['POST'])
@login_required
@customer_required
def add_review():
    try:
        data = request.json
        
        # Validate required fields
        required_fields = ['employee_id', 'customer_name', 'customer_email', 'rating']
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({'error': f'{field} is required'}), 400
        
        # Validate rating
        try:
            rating = int(data['rating'])
            if rating < 1 or rating > 5:
                return jsonify({'error': 'Rating must be between 1 and 5'}), 400
        except ValueError:
            return jsonify({'error': 'Rating must be a number'}), 400
        
        connection = get_db_connection()
        try:
            with connection.cursor() as cursor:
                # Check if employee exists
                cursor.execute("SELECT id FROM employees WHERE id = %s", (data['employee_id'],))
                if not cursor.fetchone():
                    return jsonify({'error': 'Employee not found'}), 404
                
                # Insert new review
                cursor.execute("""
                    INSERT INTO customer_reviews 
                    (employee_id, customer_name, customer_email, rating, comment, date)
                    VALUES (%s, %s, %s, %s, %s, %s)
                """, (
                    data['employee_id'],
                    data['customer_name'],
                    data['customer_email'],
                    rating,
                    data.get('comment', ''),
                    datetime.now().strftime('%Y-%m-%d')
                ))
                
                # Update employee rating and review count
                cursor.execute("""
                    UPDATE employees
                    SET 
                        customer_rating = (
                            SELECT AVG(rating) 
                            FROM customer_reviews 
                            WHERE employee_id = %s
                        ),
                        review_count = (
                            SELECT COUNT(*) 
                            FROM customer_reviews 
                            WHERE employee_id = %s
                        )
                    WHERE id = %s
                """, (data['employee_id'], data['employee_id'], data['employee_id']))
                
                connection.commit()
                
                return jsonify({'success': True})
        except pymysql.MySQLError as e:
            connection.rollback()
            return jsonify({'error': str(e)}), 500
        finally:
            connection.close()
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/analytics', methods=['GET'])
@login_required
@admin_required
def get_analytics():
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            # Department ratings
            cursor.execute("""
                SELECT 
                    e.department,
                    AVG(e.customer_rating) as avg_rating
                FROM employees e
                WHERE e.review_count > 0
                GROUP BY e.department
            """)
            department_ratings = cursor.fetchall()
            
            # Performance trend (last 6 months)
            cursor.execute("""
                SELECT 
                    MONTH(date) as month,
                    AVG(rating) as avg_rating
                FROM customer_reviews
                WHERE date >= DATE_SUB(CURRENT_DATE, INTERVAL 6 MONTH)
                GROUP BY MONTH(date)
                ORDER BY month
            """)
            performance_trend = cursor.fetchall()
            
            # Rating categories (mock data for now)
            rating_categories = [
                {'category': 'Service', 'rating': 4.3},
                {'category': 'Communication', 'rating': 4.2},
                {'category': 'Problem Solving', 'rating': 4.1},
                {'category': 'Timeliness', 'rating': 4.4},
                {'category': 'Professionalism', 'rating': 4.5}
            ]
            
            # Top performers
            cursor.execute("""
                SELECT 
                    name,
                    customer_rating
                FROM employees
                WHERE review_count > 0
                ORDER BY customer_rating DESC
                LIMIT 5
            """)
            top_performers = cursor.fetchall()
            
            # Convert Decimal values to float before returning JSON
            analytics_data = {
                'department_ratings': convert_decimal_to_float(department_ratings),
                'performance_trend': convert_decimal_to_float(performance_trend),
                'rating_categories': rating_categories,
                'top_performers': convert_decimal_to_float(top_performers)
            }
            
            return jsonify(analytics_data)
    finally:
        connection.close()

@app.route('/api/departments', methods=['GET'])
@login_required
@admin_required
def get_departments():
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT * FROM departments")
            departments = cursor.fetchall()
            # Convert Decimal values to float before returning JSON
            departments = convert_decimal_to_float(departments)
            return jsonify(departments)
    finally:
        connection.close()

@app.route('/api/signup', methods=['POST'])
def signup():
    try:
        data = request.json
        
        # Validate required fields
        required_fields = ['name', 'username', 'email', 'password', 'role']
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({'error': f'{field} is required'}), 400
        
        # Trim and validate role
        role = data['role'].strip().lower()
        if role not in ['admin', 'customer']:
            return jsonify({'error': 'Invalid role. Only admin and customer roles are allowed.'}), 400
        
        connection = get_db_connection()
        try:
            with connection.cursor() as cursor:
                # Check if username already exists
                cursor.execute("SELECT id FROM users WHERE username = %s", (data['username'].strip(),))
                if cursor.fetchone():
                    return jsonify({'error': 'Username already exists'}), 400
                
                # Check if email already exists
                cursor.execute("SELECT id FROM users WHERE email = %s", (data['email'].strip(),))
                if cursor.fetchone():
                    return jsonify({'error': 'Email already exists'}), 400
                
                # Hash password
                hashed_password = bcrypt.hashpw(data['password'].encode('utf-8'), bcrypt.gensalt())
                
                # Insert new user
                cursor.execute("""
                    INSERT INTO users (name, username, email, password, role)
                    VALUES (%s, %s, %s, %s, %s)
                """, (
                    data['name'].strip(),
                    data['username'].strip(),
                    data['email'].strip(),
                    hashed_password.decode('utf-8'),
                    role  # Use the cleaned role
                ))
                
                connection.commit()
                
                return jsonify({'success': True})
        except pymysql.MySQLError as e:
            connection.rollback()
            # Handle specific database errors
            if "Data truncated" in str(e):
                return jsonify({'error': 'Invalid role value. Role must be either "admin" or "customer".'}), 400
            return jsonify({'error': str(e)}), 500
        finally:
            connection.close()
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)
