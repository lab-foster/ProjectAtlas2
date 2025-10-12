/**
 * Project Atlas - Contact Form JavaScript
 * Client-side validation and AJAX form submission
 * Author: Andrew Foster
 * Last Updated: October 2025
 */

(function() {
    'use strict';

    // Get form elements
    const form = document.getElementById('contactForm');
    const submitBtn = document.getElementById('submitBtn');
    const messageContainer = document.getElementById('form-message');
    const messageTextEl = messageContainer ? messageContainer.querySelector('.message-text') : null;
    const charCounter = document.getElementById('char-counter');
    const messageField = document.getElementById('message');

    // Initialize character counter
    if (messageField && charCounter) {
        messageField.addEventListener('input', updateCharCounter);
        updateCharCounter(); // Initial count
    }

    function updateCharCounter() {
        const count = messageField.value.length;
        charCounter.textContent = count;
        
        // Change color when approaching limit
        if (count > 1900) {
            charCounter.style.color = '#ff6b6b';
        } else if (count > 1800) {
            charCounter.style.color = '#ffa500';
        } else {
            charCounter.style.color = '';
        }
    }

    // Real-time validation functions
    function validateName(name) {
        if (!name || name.length < 2) {
            return 'Name must be at least 2 characters long.';
        }
        if (name.length > 100) {
            return 'Name must not exceed 100 characters.';
        }
        return '';
    }

    function validateEmail(email) {
        if (!email) {
            return 'Email is required.';
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return 'Please enter a valid email address.';
        }
        return '';
    }

    function validatePhone(phone) {
        if (!phone) return ''; // Phone is optional
        const phoneRegex = /^[0-9\-\+\(\)\s]+$/;
        if (!phoneRegex.test(phone)) {
            return 'Please enter a valid phone number.';
        }
        return '';
    }

    function validateMessage(message) {
        if (!message || message.length < 10) {
            return 'Message must be at least 10 characters long.';
        }
        if (message.length > 2000) {
            return 'Message must not exceed 2000 characters.';
        }
        return '';
    }

    // Show field error
    function showFieldError(fieldId, message) {
        const errorEl = document.getElementById(fieldId + '-error');
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.style.display = message ? 'block' : 'none';
        }
    }

    // Clear field error
    function clearFieldError(fieldId) {
        showFieldError(fieldId, '');
    }

    // Real-time validation listeners
    if (form) {
        // Name validation
        const nameField = document.getElementById('name');
        if (nameField) {
            nameField.addEventListener('blur', function() {
                const error = validateName(this.value.trim());
                showFieldError('name', error);
            });
            nameField.addEventListener('input', function() {
                if (this.value.trim().length >= 2) {
                    clearFieldError('name');
                }
            });
        }

        // Email validation
        const emailField = document.getElementById('email');
        if (emailField) {
            emailField.addEventListener('blur', function() {
                const error = validateEmail(this.value.trim());
                showFieldError('email', error);
            });
            emailField.addEventListener('input', function() {
                if (this.value.includes('@') && this.value.includes('.')) {
                    clearFieldError('email');
                }
            });
        }

        // Phone validation
        const phoneField = document.getElementById('phone');
        if (phoneField) {
            phoneField.addEventListener('blur', function() {
                const error = validatePhone(this.value.trim());
                showFieldError('phone', error);
            });
        }

        // Message validation
        if (messageField) {
            messageField.addEventListener('blur', function() {
                const error = validateMessage(this.value.trim());
                showFieldError('message', error);
            });
            messageField.addEventListener('input', function() {
                if (this.value.trim().length >= 10) {
                    clearFieldError('message');
                }
            });
        }
    }

    // Show form message
    function showMessage(type, message) {
        if (!messageContainer || !messageTextEl) return;
        
        messageContainer.className = 'form-message ' + type;
        messageTextEl.textContent = message;
        messageContainer.style.display = 'block';
        
        // Scroll to message
        messageContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        
        // Auto-hide success messages after 10 seconds
        if (type === 'success') {
            setTimeout(function() {
                if (messageContainer.classList.contains('success')) {
                    closeMessage();
                }
            }, 10000);
        }
    }

    // Close message
    window.closeMessage = function() {
        if (messageContainer) {
            messageContainer.style.display = 'none';
        }
    };

    // Form submission handler
    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Clear previous errors
            clearFieldError('name');
            clearFieldError('email');
            clearFieldError('phone');
            clearFieldError('message');
            closeMessage();

            // Validate all fields
            const nameValue = document.getElementById('name').value.trim();
            const emailValue = document.getElementById('email').value.trim();
            const phoneValue = document.getElementById('phone') ? document.getElementById('phone').value.trim() : '';
            const messageValue = messageField.value.trim();

            let hasErrors = false;

            const nameError = validateName(nameValue);
            if (nameError) {
                showFieldError('name', nameError);
                hasErrors = true;
            }

            const emailError = validateEmail(emailValue);
            if (emailError) {
                showFieldError('email', emailError);
                hasErrors = true;
            }

            const phoneError = validatePhone(phoneValue);
            if (phoneError) {
                showFieldError('phone', phoneError);
                hasErrors = true;
            }

            const msgError = validateMessage(messageValue);
            if (msgError) {
                showFieldError('message', msgError);
                hasErrors = true;
            }

            if (hasErrors) {
                showMessage('error', 'Please correct the errors in your submission.');
                return;
            }

            // Disable submit button and show loading
            submitBtn.disabled = true;
            submitBtn.querySelector('.btn-text').style.display = 'none';
            submitBtn.querySelector('.btn-loading').style.display = 'inline-flex';

            // Prepare form data
            const formData = new FormData(form);

            // Send AJAX request
            fetch(form.action, {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showMessage('success', data.message);
                    form.reset();
                    updateCharCounter(); // Reset counter
                } else {
                    showMessage('error', data.message || 'An error occurred. Please try again.');
                    
                    // Show field-specific errors if provided
                    if (data.errors) {
                        for (let field in data.errors) {
                            showFieldError(field, data.errors[field]);
                        }
                    }
                }
            })
            .catch(error => {
                console.error('Form submission error:', error);
                showMessage('error', 'Sorry, there was an error sending your message. Please try again or email us directly at andrew@projectatlas.dev');
            })
            .finally(() => {
                // Re-enable submit button
                submitBtn.disabled = false;
                submitBtn.querySelector('.btn-text').style.display = 'inline';
                submitBtn.querySelector('.btn-loading').style.display = 'none';
            });
        });
    }

    // Prevent accidental form abandonment
    let formModified = false;
    if (form) {
        form.addEventListener('input', function() {
            formModified = true;
        });

        window.addEventListener('beforeunload', function(e) {
            if (formModified && !form.classList.contains('submitted')) {
                e.preventDefault();
                e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
                return e.returnValue;
            }
        });

        form.addEventListener('submit', function() {
            formModified = false;
            form.classList.add('submitted');
        });
    }

    // Keyboard accessibility
    if (messageContainer) {
        const closeButton = messageContainer.querySelector('.message-close');
        if (closeButton) {
            closeButton.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    closeMessage();
                }
            });
        }
    }

})();
