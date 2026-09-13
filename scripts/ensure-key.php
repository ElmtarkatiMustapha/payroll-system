<?php

// Local setup must preserve the encryption key of an existing workspace.
$path = dirname(__DIR__).'/.env';
$contents = file_get_contents($path);
if (! preg_match('/^APP_KEY=\S+/m', $contents)) {
    $line = 'APP_KEY=base64:'.base64_encode(random_bytes(32));
    $contents = preg_match('/^APP_KEY=.*$/m', $contents)
        ? preg_replace('/^APP_KEY=.*$/m', $line, $contents)
        : $contents.PHP_EOL.$line.PHP_EOL;
    file_put_contents($path, $contents);
}
