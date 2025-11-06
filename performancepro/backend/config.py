import os

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or '241bfbec502a9482be274b09024c79ec'
    SQLALCHEMY_DATABASE_URI = 'mysql+pymysql://root:root%40123@localhost/employee_pro'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
