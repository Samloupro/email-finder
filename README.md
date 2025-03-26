# email-finder

# API Documentation

## Overview

This API is designed to find a person's email using their full name and company domain, with every email verified by MailTester.ninja

First : Get your API Key from MailTester.ninja


## Example Request

GET url = "https://ninja-finder.samloupro.workers.dev/"  
params = {
"full_name": "Saad Belcaid",
"company_website": "myoprocess.com",
"token": "TGloaFB6K3Fkd1ZNcVRla1BrVFhsd05rcHRYWjBkOFhnSmJZZjZpZ21za25KYzZJang5bUU3dVdTb1h..."
}

## Example Response

[
{
"email": "saadb@myoprocess.com",
"status": "valid",
"message": "deliverable",
"user_name": "Saadb",
"domain": "myoprocess.com",
"mx": "aspmx.l.google.com",
"connections": 3,
"ver_ops": 7,
"time_exec": 2.82
}
]


## Request Parameters

- **full_name** (string): The full name of the user. Required.
- **company_website** (string): The company website URL or domain. The API will extract the domain using a regex for validation. Required.
- **token** (string): A token for authentication. Required. // Get your API Key from MailTester.ninja




### Response Format

The response is a JSON array containing an object with the following fields:

- **email** (string): The verified email address.
- **status** (string): Email status derived from the verification result’s code. It will be:
  - "Valid_email" if the result.code is "ok".
  - "not_found" if the result.code is "ko" or "mb".
- **message** (string): A standardized message. If the original verification message is "Accepted" or "Limited", it will display "deliverable"; otherwise, it will display the original message.
- **user_name** (string): The user name extracted from the email.
- **domain** (string): The domain of the email.
- **mx** (string): Mail exchange server information.
- **connections** (number): The number of connections made during verification.
- **ver_ops** (number): The number of verification operations performed.
- **time_exec** (number): Execution time in seconds.



