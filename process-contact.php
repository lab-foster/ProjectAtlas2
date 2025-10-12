<?php
/**
 * Project Atlas - Contact Form Processor
 * Handles form submission with validation and email notification
 * Author: Andrew Foster
 * Last Updated: October 2025
 */

// Enable error reporting for development (disable in production)
error_reporting(E_ALL);
ini_set('display_errors', 0); // Set to 0 in production
ini_set('log_errors', 1);
ini_set('error_log', 'php-errors.log');

// Set response headers
header('Content-Type: application/json');

// Function to sanitize input
function sanitize_input($data) {
    $data = trim($data);
    $data = stripslashes($data);
    $data = htmlspecialchars($data, ENT_QUOTES, 'UTF-8');
    return $data;
}

// Function to validate email
function validate_email($email) {
    return filter_var($email, FILTER_VALIDATE_EMAIL);
}

// Function to validate phone number
function validate_phone($phone) {
    // Allow common phone formats
    return preg_match('/^[0-9\-\+\(\)\s]+$/', $phone);
}

// Initialize response array
$response = array(
    'success' => false,
    'message' => '',
    'errors' => array()
);

// Check if form was submitted via POST
if ($_SERVER["REQUEST_METHOD"] != "POST") {
    $response['message'] = 'Invalid request method.';
    echo json_encode($response);
    exit;
}

// Honeypot check for spam prevention
if (!empty($_POST['website'])) {
    // This is likely a bot - silently fail
    sleep(2); // Add delay to frustrate bots
    $response['message'] = 'Thank you for your submission!';
    echo json_encode($response);
    exit;
}

// Get and sanitize form data
$name = isset($_POST['name']) ? sanitize_input($_POST['name']) : '';
$email = isset($_POST['email']) ? sanitize_input($_POST['email']) : '';
$phone = isset($_POST['phone']) ? sanitize_input($_POST['phone']) : '';
$project_type = isset($_POST['project_type']) ? sanitize_input($_POST['project_type']) : '';
$experience = isset($_POST['experience']) ? sanitize_input($_POST['experience']) : '';
$tools = isset($_POST['tools']) ? sanitize_input($_POST['tools']) : '';
$message = isset($_POST['message']) ? sanitize_input($_POST['message']) : '';
$beta = isset($_POST['beta']) ? 'Yes' : 'No';
$newsletter = isset($_POST['newsletter']) ? 'Yes' : 'No';

// Validation
$errors = array();

// Validate required fields
if (empty($name)) {
    $errors['name'] = 'Name is required.';
} elseif (strlen($name) < 2 || strlen($name) > 100) {
    $errors['name'] = 'Name must be between 2 and 100 characters.';
}

if (empty($email)) {
    $errors['email'] = 'Email is required.';
} elseif (!validate_email($email)) {
    $errors['email'] = 'Please enter a valid email address.';
}

if (!empty($phone) && !validate_phone($phone)) {
    $errors['phone'] = 'Please enter a valid phone number.';
}

if (empty($message)) {
    $errors['message'] = 'Message is required.';
} elseif (strlen($message) < 10) {
    $errors['message'] = 'Message must be at least 10 characters long.';
} elseif (strlen($message) > 2000) {
    $errors['message'] = 'Message must not exceed 2000 characters.';
}

// If there are validation errors, return them
if (!empty($errors)) {
    $response['message'] = 'Please correct the errors in your submission.';
    $response['errors'] = $errors;
    echo json_encode($response);
    exit;
}

// Prepare email content
$to = "andrew@projectatlas.dev"; // Change this to your email
$subject = "New Contact Form Submission - Project Atlas";

// Create email body
$email_body = "New contact form submission from Project Atlas website\n\n";
$email_body .= "Contact Information:\n";
$email_body .= "Name: $name\n";
$email_body .= "Email: $email\n";
if (!empty($phone)) {
    $email_body .= "Phone: $phone\n";
}
$email_body .= "\nProject Details:\n";
if (!empty($project_type)) {
    $email_body .= "Main Challenge: $project_type\n";
}
if (!empty($experience)) {
    $email_body .= "Experience Level: $experience\n";
}
if (!empty($tools)) {
    $email_body .= "Current Tools: $tools\n";
}
$email_body .= "\nMessage:\n$message\n\n";
$email_body .= "Beta Testing Interest: $beta\n";
$email_body .= "Newsletter Subscription: $newsletter\n\n";
$email_body .= "---\n";
$email_body .= "Submitted: " . date('Y-m-d H:i:s') . "\n";
$email_body .= "IP Address: " . $_SERVER['REMOTE_ADDR'] . "\n";

// Email headers
$headers = array();
$headers[] = "From: Project Atlas <noreply@projectatlas.dev>";
$headers[] = "Reply-To: $name <$email>";
$headers[] = "MIME-Version: 1.0";
$headers[] = "Content-Type: text/plain; charset=UTF-8";
$headers[] = "X-Mailer: PHP/" . phpversion();

// Send email
$mail_sent = @mail($to, $subject, $email_body, implode("\r\n", $headers));

// Store submission in a log file (optional)
$log_entry = date('Y-m-d H:i:s') . " | $name | $email | " . substr($message, 0, 50) . "...\n";
@file_put_contents('contact-submissions.log', $log_entry, FILE_APPEND | LOCK_EX);

// Optional: Store in database
// You can add database storage here if needed
// Example:
// try {
//     $pdo = new PDO("mysql:host=localhost;dbname=your_db", "username", "password");
//     $stmt = $pdo->prepare("INSERT INTO contact_submissions (name, email, phone, message, submitted_at) VALUES (?, ?, ?, ?, NOW())");
//     $stmt->execute([$name, $email, $phone, $message]);
// } catch(PDOException $e) {
//     error_log("Database error: " . $e->getMessage());
// }

// Prepare success response
if ($mail_sent) {
    $response['success'] = true;
    $response['message'] = 'Thank you for your message, ' . htmlspecialchars($name) . '! We\'ll get back to you within 24 hours.';
    
    if ($beta === 'Yes') {
        $response['message'] .= ' You\'ve been added to our beta testing list.';
    }
} else {
    // Email failed to send
    $response['message'] = 'Sorry, there was an error sending your message. Please try again or email us directly at andrew@projectatlas.dev';
    error_log("Mail function failed for submission from: $email");
}

// Return JSON response
echo json_encode($response);
exit;
?>
