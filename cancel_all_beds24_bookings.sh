#!/bin/bash

# Script to cancel ALL bookings in Beds24 API (change status to cancelled)
# Usage: ./cancel_all_beds24_bookings.sh YOUR_ACCESS_TOKEN [PROPERTY_ID] [ORGANIZATION_NAME]

set -e

ACCESS_TOKEN="${1}"
PROPERTY_ID="${2}"
ORG_HEADER="${3:+organization: $3}"

if [ -z "$ACCESS_TOKEN" ]; then
    echo "Error: Access token is required"
    echo "Usage: $0 ACCESS_TOKEN [PROPERTY_ID] [ORGANIZATION_NAME]"
    echo ""
    echo "To get an access token:"
    echo "  1. Get refresh token: curl -X GET 'https://api.beds24.com/v2/authentication/setup' -H 'code: YOUR_INVITE_CODE'"
    echo "  2. Get access token: curl -X GET 'https://api.beds24.com/v2/authentication/token' -H 'refreshToken: YOUR_REFRESH_TOKEN'"
    exit 1
fi

BASE_URL="https://api.beds24.com/v2"
TEMP_DIR=$(mktemp -d)
BOOKINGS_FILE="${TEMP_DIR}/all_bookings.json"

# Cleanup function
cleanup() {
    rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

echo "=========================================="
echo "Beds24 - Cancel All Bookings"
echo "=========================================="
echo ""

# Step 1: Fetch all bookings
echo "Step 1: Fetching all bookings..."

PAGE=1
ALL_BOOKING_IDS=()

while true; do
    echo "  Fetching page $PAGE..."
    
    # Build query parameters
    QUERY_PARAMS=""
    if [ -n "$PROPERTY_ID" ]; then
        QUERY_PARAMS="?propertyId=$PROPERTY_ID"
    fi
    
    # Include all statuses to get everything (including already cancelled)
    if [ -z "$QUERY_PARAMS" ]; then
        QUERY_PARAMS="?status=confirmed&status=request&status=new&status=cancelled&status=black&status=inquiry"
    else
        QUERY_PARAMS="${QUERY_PARAMS}&status=confirmed&status=request&status=new&status=cancelled&status=black&status=inquiry"
    fi
    
    # Add page parameter if not first page
    if [ "$PAGE" -gt 1 ]; then
        QUERY_PARAMS="${QUERY_PARAMS}&page=$PAGE"
    fi
    
    # Make request
    RESPONSE=$(curl -s -X GET "${BASE_URL}/bookings${QUERY_PARAMS}" \
        -H "token: ${ACCESS_TOKEN}" \
        ${ORG_HEADER:+-H "$ORG_HEADER"} \
        -w "\n%{http_code}")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    
    if [ "$HTTP_CODE" != "200" ]; then
        echo "  Error: HTTP $HTTP_CODE"
        echo "  Response: $BODY"
        exit 1
    fi
    
    # Parse response - handle both array and paginated format
    if echo "$BODY" | jq -e '.data' > /dev/null 2>&1; then
        # Paginated response
        BOOKING_IDS=$(echo "$BODY" | jq -r '.data[]? | select(.status != "cancelled") | .id // empty')
        HAS_NEXT=$(echo "$BODY" | jq -r '.pages.nextPageExists // false')
    elif echo "$BODY" | jq -e 'type == "array"' > /dev/null 2>&1; then
        # Direct array response
        BOOKING_IDS=$(echo "$BODY" | jq -r '.[]? | select(.status != "cancelled") | .id // empty')
        HAS_NEXT=false
    else
        echo "  Error: Unexpected response format"
        echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
        exit 1
    fi
    
    # Count bookings on this page (excluding already cancelled)
    COUNT=$(echo "$BOOKING_IDS" | grep -c . || echo "0")
    echo "  Found $COUNT non-cancelled bookings on page $PAGE"
    
    if [ "$COUNT" -eq 0 ] && [ "$PAGE" -eq 1 ]; then
        echo "No bookings found or all bookings are already cancelled."
        exit 0
    fi
    
    # Add to array
    while IFS= read -r id; do
        if [ -n "$id" ] && [ "$id" != "null" ]; then
            ALL_BOOKING_IDS+=("$id")
        fi
    done <<< "$BOOKING_IDS"
    
    # Check if there's a next page
    if [ "$HAS_NEXT" = "false" ] || [ "$HAS_NEXT" = "null" ]; then
        break
    fi
    
    PAGE=$((PAGE + 1))
    
    # Rate limiting: wait a bit between requests
    sleep 0.5
done

TOTAL_BOOKINGS=${#ALL_BOOKING_IDS[@]}
echo ""
echo "Total non-cancelled bookings found: $TOTAL_BOOKINGS"

if [ "$TOTAL_BOOKINGS" -eq 0 ]; then
    echo "No bookings to cancel. All bookings are already cancelled."
    exit 0
fi

# Step 2: Confirm cancellation
echo ""
read -p "Are you sure you want to CANCEL ALL $TOTAL_BOOKINGS bookings? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Cancellation cancelled."
    exit 0
fi

# Step 3: Cancel bookings in batches
echo ""
echo "Step 2: Cancelling bookings..."
echo ""

BATCH_SIZE=50  # Update 50 at a time to avoid payload size issues
CANCELLED=0
FAILED=0
BATCH_NUM=1

for i in $(seq 0 $BATCH_SIZE $((TOTAL_BOOKINGS - 1))); do
    END=$((i + BATCH_SIZE - 1))
    if [ "$END" -ge "$TOTAL_BOOKINGS" ]; then
        END=$((TOTAL_BOOKINGS - 1))
    fi
    
    # Build JSON array for batch update
    JSON_BATCH="["
    FIRST=true
    for j in $(seq $i $END); do
        if [ "$FIRST" = true ]; then
            FIRST=false
        else
            JSON_BATCH="${JSON_BATCH},"
        fi
        JSON_BATCH="${JSON_BATCH}{\"id\":${ALL_BOOKING_IDS[$j]},\"status\":\"cancelled\"}"
    done
    JSON_BATCH="${JSON_BATCH}]"
    
    BATCH_COUNT=$((END - i + 1))
    echo "  Batch $BATCH_NUM: Cancelling $BATCH_COUNT bookings (IDs: ${ALL_BOOKING_IDS[$i]} to ${ALL_BOOKING_IDS[$END]})..."
    
    # Make POST request to update bookings
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE_URL}/bookings" \
        -H "token: ${ACCESS_TOKEN}" \
        -H "Content-Type: application/json" \
        ${ORG_HEADER:+-H "$ORG_HEADER"} \
        -d "$JSON_BATCH")
    
    if [ "$HTTP_CODE" = "201" ] || [ "$HTTP_CODE" = "200" ]; then
        CANCELLED=$((CANCELLED + BATCH_COUNT))
        echo "    ✓ Success (HTTP $HTTP_CODE)"
    else
        FAILED=$((FAILED + BATCH_COUNT))
        echo "    ✗ Failed (HTTP $HTTP_CODE)"
        # Try to get error details
        ERROR_RESPONSE=$(curl -s -X POST "${BASE_URL}/bookings" \
            -H "token: ${ACCESS_TOKEN}" \
            -H "Content-Type: application/json" \
            ${ORG_HEADER:+-H "$ORG_HEADER"} \
            -d "$JSON_BATCH")
        echo "    Error details: $(echo "$ERROR_RESPONSE" | jq -r '.error // .' 2>/dev/null || echo "$ERROR_RESPONSE")"
    fi
    
    BATCH_NUM=$((BATCH_NUM + 1))
    
    # Rate limiting: wait between batches (100 requests per 5 minutes = ~3 seconds between requests)
    # But we're batching, so wait 1 second between batches
    if [ "$i" -lt $((TOTAL_BOOKINGS - BATCH_SIZE)) ]; then
        sleep 1
    fi
done

# Summary
echo ""
echo "=========================================="
echo "Cancellation Summary:"
echo "=========================================="
echo "Total non-cancelled bookings found: $TOTAL_BOOKINGS"
echo "Successfully cancelled: $CANCELLED"
echo "Failed: $FAILED"
echo ""

if [ "$FAILED" -eq 0 ]; then
    echo "✓ All bookings cancelled successfully!"
else
    echo "⚠ Some bookings failed to cancel. Check the errors above."
fi

