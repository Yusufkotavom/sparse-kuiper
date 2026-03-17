from pydantic import BaseModel
from typing import Optional


class ListQuery(BaseModel):
    account_id: str
    parent_id: Optional[str] = None
    q: Optional[str] = None
    page_token: Optional[str] = None


class CreateFolderPayload(BaseModel):
    account_id: str
    name: str
    parent_id: Optional[str] = None


class DeletePayload(BaseModel):
    account_id: str
    file_id: str


class MovePayload(BaseModel):
    account_id: str
    file_id: str
    target_parent_id: str


class ImportToVideoProjectPayload(BaseModel):
    account_id: str
    parent_id: str
    project_name: str
    file_ids: Optional[list[str]] = None


class ImportToKdpProjectPayload(BaseModel):
    account_id: str
    parent_id: str
    project_name: str
    file_ids: Optional[list[str]] = None
