#!/usr/bin/env python3
"""
Script to enhance Postman collection with tests and scripts
"""
import json
import sys
from typing import Dict, Any, List


def get_test_script_for_request(request_name: str, method: str) -> str:
    """Generate appropriate test script based on request type"""
    tests = []
    
    # Status code tests based on method
    if method == "GET":
        tests.append('pm.test("Status code is 200", function () {')
        tests.append('    pm.response.to.have.status(200);')
        tests.append('});')
    elif method == "POST":
        tests.append('pm.test("Status code is 200 or 201", function () {')
        tests.append('    pm.expect(pm.response.code).to.be.oneOf([200, 201]);')
        tests.append('});')
    elif method == "DELETE":
        tests.append('pm.test("Status code is 200 or 204", function () {')
        tests.append('    pm.expect(pm.response.code).to.be.oneOf([200, 204]);')
        tests.append('});')
    elif method in ["PUT", "PATCH"]:
        tests.append('pm.test("Status code is 200", function () {')
        tests.append('    pm.response.to.have.status(200);')
        tests.append('});')
    
    # Response time test
    tests.append('')
    tests.append('pm.test("Response time is less than 2000ms", function () {')
    tests.append('    pm.expect(pm.response.responseTime).to.be.below(2000);')
    tests.append('});')
    
    # Content-Type test
    tests.append('')
    tests.append('pm.test("Content-Type is present", function () {')
    tests.append('    pm.response.to.have.header("Content-Type");')
    tests.append('});')
    
    # Parse response body if JSON (except for 204 responses)
    if method != "DELETE" or "delete all" not in request_name.lower():
        tests.append('')
        tests.append('// Parse and validate JSON response (if applicable)')
        tests.append('if (pm.response.code !== 204 && pm.response.headers.get("Content-Type")?.includes("application/json")) {')
        tests.append('    pm.test("Response is valid JSON", function () {')
        tests.append('        pm.response.to.be.json;')
        tests.append('    });')
        tests.append('}')
    
    # Special handling for login to save token
    if "login" in request_name.lower():
        tests.append('')
        tests.append('// Save auth token from login response')
        tests.append('if (pm.response.code === 200) {')
        tests.append('    const jsonData = pm.response.json();')
        tests.append('    if (jsonData.token) {')
        tests.append('        pm.environment.set("bearerToken", jsonData.token);')
        tests.append('        pm.test("Token received and saved", function () {')
        tests.append('            pm.expect(jsonData.token).to.be.a("string");')
        tests.append('        });')
        tests.append('    }')
        tests.append('}')
    
    return '\n'.join(tests)


def get_prerequest_script() -> str:
    """Generate pre-request script"""
    script = []
    script.append('// Pre-request Script')
    script.append('console.log("Request: " + pm.info.requestName);')
    script.append('console.log("URL: " + pm.request.url);')
    script.append('console.log("Method: " + pm.request.method);')
    script.append('')
    script.append('// Set timestamp variable for dynamic data')
    script.append('pm.variables.set("timestamp", Date.now());')
    
    return '\n'.join(script)


def add_scripts_to_request(item: Dict[str, Any]) -> None:
    """Add test and pre-request scripts to a request item"""
    if "request" in item:
        request = item["request"]
        method = request.get("method", "GET")
        request_name = item.get("name", "")
        
        # Add pre-request script
        if "event" not in request:
            request["event"] = []
        
        # Check if pre-request script already exists
        has_prerequest = any(e.get("listen") == "prerequest" for e in request["event"])
        if not has_prerequest:
            prerequest_event = {
                "listen": "prerequest",
                "script": {
                    "exec": get_prerequest_script().split('\n'),
                    "type": "text/javascript"
                }
            }
            request["event"].append(prerequest_event)
        
        # Check if test script already exists
        has_test = any(e.get("listen") == "test" for e in request["event"])
        if not has_test:
            test_event = {
                "listen": "test",
                "script": {
                    "exec": get_test_script_for_request(request_name, method).split('\n'),
                    "type": "text/javascript"
                }
            }
            request["event"].append(test_event)


def process_item(item: Dict[str, Any]) -> None:
    """Recursively process collection items"""
    if "item" in item:
        # This is a folder, process children
        for child in item["item"]:
            process_item(child)
    else:
        # This is a request, add scripts
        add_scripts_to_request(item)


def enhance_postman_collection(input_file: str, output_file: str) -> None:
    """Main function to enhance Postman collection"""
    print(f"Reading collection from: {input_file}")
    
    with open(input_file, 'r') as f:
        collection = json.load(f)
    
    print("Processing collection items...")
    
    # Process all items in the collection
    if "item" in collection:
        for item in collection["item"]:
            process_item(item)
    
    print(f"Writing enhanced collection to: {output_file}")
    
    with open(output_file, 'w') as f:
        json.dump(collection, f, indent='\t')
    
    print("Done! Collection has been enhanced with tests and scripts.")


if __name__ == "__main__":
    input_file = "Mom API.postman_collection.json"
    output_file = "Mom API.postman_collection.json"
    
    if len(sys.argv) > 1:
        input_file = sys.argv[1]
    if len(sys.argv) > 2:
        output_file = sys.argv[2]
    
    enhance_postman_collection(input_file, output_file)
