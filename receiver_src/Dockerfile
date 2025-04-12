# This Dockerfile is for the receiver service of the project.
# It uses a slim version of Python 3.11 as the base image.
FROM python:3.11-slim 

# Set the working directory to /proj
# This is where the application code will be copied to.
WORKDIR /proj

# Copy the application to the working directory
COPY . .


# Install dependencies needed for running the receiver
RUN pip install --no-cache-dir -r requirements.txt

# Expose port 5001 for the receiver service
EXPOSE 5001

# This is used for Flask to not sent the logs about requests in console.
ENV FLASK_ENV=production

# Commnad for running the receiver.
CMD ["python", "receiver.py"]