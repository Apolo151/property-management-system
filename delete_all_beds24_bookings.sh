#!/bin/bash

# Script to delete ALL bookings from Beds24 API
# Usage: ./delete_all_beds24_bookings.sh YOUR_ACCESS_TOKEN [PROPERTY_ID] [ORGANIZATION_NAME]

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
IDS_FILE="${TEMP_DIR}/booking_ids.txt"

# Cleanup function
cleanup() {
    rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

echo "=========================================="
echo "Beds24 - Delete All Bookings"
echo "=========================================="
echo ""

# Step 1: Fetch all bookings
echo "Step 1: Fetching all bookings..."

PAGE=1
ALL_BOOKINGS=()

while true; do
    echo "  Fetching page $PAGE..."
    
    # Build query parameters
    QUERY_PARAMS=""
    if [ -n "$PROPERTY_ID" ]; then
        QUERY_PARAMS="?propertyId=$PROPERTY_ID"
    fi
    
    # Include all statuses to get everything (including cancelled)
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
        BOOKINGS=$(echo "$BODY" | jq -r '.data[]? | .id // empty')
        HAS_NEXT=$(echo "$BODY" | jq -r '.pages.nextPageExists // false')
    elif echo "$BODY" | jq -e 'type == "array"' > /dev/null 2>&1; then
        # Direct array response
        BOOKINGS=$(echo "$BODY" | jq -r '.[]? | .id // empty')
        HAS_NEXT=false
    else
        echo "  Error: Unexpected response format"
        echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
        exit 1
    fi
    
    # Count bookings on this page
    COUNT=$(echo "$BOOKINGS" | grep -c . || echo "0")
    echo "  Found $COUNT bookings on page $PAGE"
    
    if [ "$COUNT" -eq 0 ]; then
        break
    fi
    
    # Add to array
    while IFS= read -r id; do
        if [ -n "$id" ] && [ "$id" != "null" ]; then
            ALL_BOOKINGS+=("$id")
        fi
    done <<< "$BOOKINGS"
    
    # Check if there's a next page
    if [ "$HAS_NEXT" = "false" ] || [ "$HAS_NEXT" = "null" ]; then
        break
    fi
    
    PAGE=$((PAGE + 1))
    
    # Rate limiting: wait a bit between requests
    sleep 0.5
done

TOTAL_BOOKINGS=${#ALL_BOOKINGS[@]}
echo ""
echo "Total bookings found: $TOTAL_BOOKINGS"

if [ "$TOTAL_BOOKINGS" -eq 0 ]; then
    echo "No bookings to delete. Exiting."
    exit 0
fi

# Step 2: Confirm deletion
echo ""
read -p "Are you sure you want to DELETE ALL $TOTAL_BOOKINGS bookings? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Deletion cancelled."
    exit 0
fi

# Step 3: Delete bookings in batches
echo ""
echo "Step 2: Deleting bookings..."
echo ""

BATCH_SIZE=50  # Delete 50 at a time to avoid URL length issues
DELETED=0
FAILED=0
BATCH_NUM=1

for i in $(seq 0 $BATCH_SIZE $((TOTAL_BOOKINGS - 1))); do
    END=$((i + BATCH_SIZE - 1))
    if [ "$END" -ge "$TOTAL_BOOKINGS" ]; then
        END=$((TOTAL_BOOKINGS - 1))
    fi
    
    # Build query string with booking IDs
    QUERY_PARAMS=""
    for j in $(seq $i $END); do
        if [ -n "$QUERY_PARAMS" ]; then
            QUERY_PARAMS="${QUERY_PARAMS}&id=${ALL_BOOKINGS[$j]}"
        else
            QUERY_PARAMS="id=${ALL_BOOKINGS[$j]}"
        fi
    done
    
    BATCH_COUNT=$((END - i + 1))
    echo "  Batch $BATCH_NUM: Deleting $BATCH_COUNT bookings (IDs: ${ALL_BOOKINGS[$i]} to ${ALL_BOOKINGS[$END]})..."
    
    # Make delete request
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "${BASE_URL}/bookings?${QUERY_PARAMS}" \
        -H "token: ${ACCESS_TOKEN}" \
        ${ORG_HEADER:+-H "$ORG_HEADER"})
    
    if [ "$HTTP_CODE" = "201" ] || [ "$HTTP_CODE" = "200" ]; then
        DELETED=$((DELETED + BATCH_COUNT))
        echo "    ✓ Success (HTTP $HTTP_CODE)"
    else
        FAILED=$((FAILED + BATCH_COUNT))
        echo "    ✗ Failed (HTTP $HTTP_CODE)"
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
echo "Deletion Summary:"
echo "=========================================="
echo "Total bookings found: $TOTAL_BOOKINGS"
echo "Successfully deleted: $DELETED"
echo "Failed: $FAILED"
echo ""

if [ "$FAILED" -eq 0 ]; then
    echo "✓ All bookings deleted successfully!"
else
    echo "⚠ Some bookings failed to delete. Check the errors above."
fi

