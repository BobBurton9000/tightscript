# Tightscript Class Instance State

For maintainers changing class-state validation, this page records the approved privacy rule and DTO boundary.

## Approved requirements

### TIGHTSCRIPT-REQ-022

- **Title:** Non-DTO classes keep instance state private

WHEN a class is not a DTO, THE SYSTEM SHALL require its instance properties and accessors, including abstract properties and constructor parameter properties, to be private. JavaScript `#private` members satisfy this requirement. Static members are outside this private-instance-state requirement.

### TIGHTSCRIPT-REQ-023

- **Title:** DTOs have only public constructor parameter properties

For REQ-022, a DTO is a class whose only declared instance properties are public constructor parameter properties and that declares no other instance properties, accessors, or methods. A constructor is allowed; any declared method, including a static method, disqualifies the class from the DTO exception. A DTO's public constructor parameter properties are permitted. Static members otherwise remain outside REQ-022.
