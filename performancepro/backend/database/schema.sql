-- Create the database
CREATE DATABASE IF NOT EXISTS employee_pro;
USE employee_pro;

-- Drop existing tables if they exist to recreate with correct schema
DROP TABLE IF EXISTS customer_reviews;
DROP TABLE IF EXISTS employees;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS departments;

-- Create tables with correct schema
CREATE TABLE departments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin', 'customer') NOT NULL,
    name VARCHAR(100) NOT NULL
);

CREATE TABLE employees (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    department VARCHAR(50) NOT NULL,
    position VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(20),
    join_date DATE NOT NULL,
    avatar VARCHAR(10) NOT NULL,
    customer_rating DECIMAL(3,1) DEFAULT 0.0,
    review_count INT DEFAULT 0
);

CREATE TABLE customer_reviews (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT NOT NULL,
    customer_name VARCHAR(100) NOT NULL,
    customer_email VARCHAR(100) NOT NULL,
    rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    date DATE NOT NULL,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

-- Insert sample departments
INSERT INTO departments (name) VALUES 
('Engineering'), ('Marketing'), ('Sales'), ('HR'), ('Finance');

-- Insert sample admin user (password: admin123)
INSERT INTO users (username, email, password, role, name) VALUES 
('admin', 'admin@company.com', '$2b$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin', 'Admin User');

-- Insert sample customer user (password: customer123)
INSERT INTO users (username, email, password, role, name) VALUES 
('customer', 'customer@example.com', '$2b$12$tZ/nJb8f5WfZjXa8a5xUeL9K7H6jT8kGf2hV3zPq1mRcN8sW4Oi', 'customer', 'Customer User');

-- Insert sample employees
INSERT INTO employees (name, department, position, email, phone, join_date, avatar) VALUES 
('John Doe', 'Engineering', 'Senior Developer', 'john.doe@company.com', '+1 (555) 123-4567', '2022-01-15', 'JD'),
('Jane Smith', 'Marketing', 'Marketing Manager', 'jane.smith@company.com', '+1 (555) 234-5678', '2021-03-20', 'JS'),
('Mike Johnson', 'Sales', 'Sales Representative', 'mike.johnson@company.com', '+1 (555) 345-6789', '2022-06-10', 'MJ'),
('Sarah Williams', 'HR', 'HR Specialist', 'sarah.williams@company.com', '+1 (555) 456-7890', '2021-11-05', 'SW'),
('David Brown', 'Engineering', 'Junior Developer', 'david.brown@company.com', '+1 (555) 567-8901', '2023-02-28', 'DB'),
('Lisa Davis', 'Finance', 'Financial Analyst', 'lisa.davis@company.com', '+1 (555) 678-9012', '2022-09-12', 'LD');

-- Insert sample customer reviews
INSERT INTO customer_reviews (employee_id, customer_name, customer_email, rating, comment, date) VALUES 
(1, 'Alice Johnson', 'alice@example.com', 5, 'Excellent service! Very knowledgeable and helpful.', '2024-01-15'),
(1, 'Bob Smith', 'bob@example.com', 4, 'Good work, solved my issue quickly.', '2024-01-10'),
(2, 'Carol White', 'carol@example.com', 5, 'Outstanding marketing strategies!', '2024-01-12'),
(3, 'David Lee', 'david@example.com', 3, 'Average service, could be better.', '2024-01-08'),
(4, 'Emma Wilson', 'emma@example.com', 5, 'Very professional and friendly!', '2024-01-14');