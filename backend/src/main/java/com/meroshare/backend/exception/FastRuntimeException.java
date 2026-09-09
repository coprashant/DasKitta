package com.meroshare.backend.exception;

/*
 Same as RuntimeException but skips capturing a stack trace.

 Used for expected business flow errors that happen often, invalid
 credentials, account not set up, share id not found and so on.
 GlobalExceptionHandler only reads getMessage for these so the stack
 trace was never used, capturing it on every throw was wasted work.

 Do not use this for real bugs, only for conditions the caller is
 expected to hit as part of normal use.
*/
public class FastRuntimeException extends RuntimeException {

    public FastRuntimeException(String message) {
        super(message, null, false, false);
    }

    public FastRuntimeException(String message, Throwable cause) {
        super(message, cause, false, false);
    }
}