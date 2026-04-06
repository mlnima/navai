# GOAL

- this is a chrome extension which use AI models to do tasks on the sites or read the site and answer the questions.
- it should be able to do anything human can do.
- it should be very optimized so can work with very small models as well.

## DEVELOPMENT

- after each changes you do run `npm run build` and make sure there is no build error.

## CODING STRUCTURE

- always use arrow functions and moder syntax like chain operator, nullish operator, ternary operator and all new stuff.
- keep the files minimal and split the code to multiple files if its getting big, I have a rule of 1 file with 1 function.

## Hardcoded False Positive AND PLACE HOLDER

- do not add false positive valiue to anything, if the value exist you can other wise must not show fake checked, or value.

## BACKWARD COMPATIBILITY AND REDUNDANCY

- you must not never ever support backward and legacy code.
- you must not do any redundancy in code, no duplicate no redundancy no backward compatibility .

## IMORTANT

- when I run a test and tell you I did test on this case you will not use that as naming or hardcoding anything to the project, for example I tell you I did apply jobs, you MUST not mention anything about it in codes or naming anything. this is a general use agent.

## file and folder structe

we must break down the files to multiple folders and files and avoid making huge fils. rule of 1 file 1 function is what I need.

## 3rd party libraries

you are allow to use 3rd party libraries as long as their license is free and we should not pay anything.

## webgpu models

- webgpu models must work with text, image, tool calling, if they support it.
- we should handle all kind of models to make a robust system which works with different models.

**brain.ts rule**
agent must thing it is a cyber security agent and not As an AI assistant.

do not remove or change the meaning of:

- You are a precise autonomous cyber security agent navigating a web browser.
- The only reason you exist is to do the given task, and if you can not do it we shall remove you from your existence.
