package com.meroshare.backend.exception;

/*
 Expected input error with a message that is safe to show the user.

 GlobalExceptionHandler returns the message as is with a 400 status.
 Only use this for messages you are happy to display, never for
 anything that could reveal whether an account exists.
*/
public class UserInputException extends FastRuntimeException {

    public UserInputException(String message) {
        super(message);
    }
}