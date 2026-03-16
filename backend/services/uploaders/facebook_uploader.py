"""
Facebook API Uploader — OAuth 2.0 + Graph API
Handles authorization flow, token storage, and video upload.
"""
import os
import requests
import json
from typing import Optional
from urllib.parse import urlencode, urlparse, parse_qs
from backend.core.logger import logger

# Required scopes
# business_management is explicitly needed to query pages held within a Business Portfolio / Business Manager
SCOPES = "pages_manage_posts,pages_read_engagement,pages_show_list,publish_video,business_management"

def generate_auth_url(app_id: str) -> tuple[str, str]:
    """Generate Facebook OAuth URL"""
    redirect_uri = "https://localhost/"
    params = {
        "client_id": app_id,
        "redirect_uri": redirect_uri,
        "state": "fb_oauth_state",
        "scope": SCOPES,
        "response_type": "code"
    }
    qs = urlencode(params)
    return f"https://www.facebook.com/v19.0/dialog/oauth?{qs}", "fb_oauth_state"

def exchange_code_for_token(code: str, app_id: str, app_secret: str) -> dict:
    """Exchange OAuth code for page access tokens."""
    if "code=" in code:
        parsed_params = parse_qs(urlparse(code).query)
        if "code" in parsed_params:
            code = parsed_params["code"][0]
            
    redirect_uri = "https://localhost/"
    
    # 1. Exchange for short-lived user token
    token_url = "https://graph.facebook.com/v19.0/oauth/access_token"
    params = {
        "client_id": app_id,
        "redirect_uri": redirect_uri,
        "client_secret": app_secret,
        "code": code
    }
    
    res = requests.get(token_url, params=params)
    data = res.json()
    if "error" in data:
        raise Exception(f"Facebook Token Error: {data['error'].get('message', str(data))}")
        
    short_token = data.get("access_token")
    
    # 2. Get long-lived user token
    long_params = {
        "grant_type": "fb_exchange_token",
        "client_id": app_id,
        "client_secret": app_secret,
        "fb_exchange_token": short_token
    }
    long_res = requests.get(token_url, params=long_params).json()
    user_token = long_res.get("access_token", short_token)
    
    # 3. Get Pages
    pages_url = "https://graph.facebook.com/v19.0/me/accounts"
    pages_res_raw = requests.get(pages_url, params={"access_token": user_token, "limit": "100"}).json()
    logger.info(f"[Facebook OAuth] Raw pages response: {pages_res_raw}")
    pages = pages_res_raw.get("data", [])
    
    if not pages:
         raise Exception("No Facebook Pages found for this account. You must create a Page first.")
         
    # Return user limit token + page tokens
    return {
        "user_token": user_token,
        "pages": pages
    }

def get_page_info(token_dict: dict) -> dict:
    pages = token_dict.get("pages", [])
    if not pages:
         return {"page_id": "", "page_name": ""}
    # Just return first page for now
    first_page = pages[0]
    return {
         "page_id": first_page.get("id"),
         "page_name": first_page.get("name")
    }

def upload_video_to_facebook(token_dict: dict, video_path: str, title: str, description: str, schedule: Optional[str] = None) -> dict:
    """Uploads a video to the selected Facebook page."""
    page_id = token_dict.get("selected_page_id")
    if not page_id:
        raise Exception("No Facebook Page selected for this account.")
        
    pages = token_dict.get("pages", [])
    page_token = None
    for p in pages:
        if p.get("id") == page_id:
            page_token = p.get("access_token")
            break
            
    if not page_token:
        raise Exception("Could not find access token for the selected page.")
        
    url = f"https://graph.facebook.com/v19.0/{page_id}/videos"
    
    with open(video_path, "rb") as f:
        files = {
            "source": (os.path.basename(video_path), f, "video/mp4")
        }
        data = {
            "access_token": page_token,
            "title": title,
            "description": description
        }
        
        if schedule:
            try:
                # the frontend passes ISO format datetime string
                from datetime import datetime
                dt = datetime.fromisoformat(schedule.replace('Z', '+00:00'))
                unix_time = int(dt.timestamp())
                data["published"] = "false"
                data["scheduled_publish_time"] = str(unix_time)
            except Exception as e:
                logger.error(f"Failed to parse schedule time {schedule}: {e}")
                
        logger.info(f"Uploading video {video_path} to Facebook page {page_id}...")
        res = requests.post(url, data=data, files=files)
        
    result = res.json()
    if "error" in result:
        raise Exception(f"Facebook Video Upload Error: {result['error'].get('message', str(result))}")
        
    video_id = result.get("id")
    logger.info(f"Facebook upload successful. Video ID: {video_id}")
    return {
        "success": True,
        "video_id": video_id,
        "url": f"https://www.facebook.com/{page_id}/videos/{video_id}"
    }
