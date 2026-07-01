import os
from fastapi import FastAPI, Request
from fastapi.exceptions import HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from database import init_db
from routes import pods, members, ideas, sprints, training, fields, defects, board, misc, backups, tests

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, 'static')

app = FastAPI(title='BlueBolt Innovation Tracker API')

# The UI is served from the same origin, so CORS is permissive for any tooling
# that wants to hit the API directly.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(HTTPException)
def http_exception_handler(request: Request, exc: HTTPException):
    # The single-page UI reads the message from an "error" key; mirror "detail"
    # there so server-side validation messages surface in toast notifications.
    return JSONResponse(status_code=exc.status_code, content={'error': exc.detail})


@app.on_event('startup')
def on_startup():
    init_db()


# ---- API routers -----------------------------------------------------------
app.include_router(pods.router)
app.include_router(members.router)
app.include_router(ideas.router)
app.include_router(sprints.router)
app.include_router(training.router)
app.include_router(fields.router)
app.include_router(defects.router)
app.include_router(board.router)
app.include_router(backups.router)
app.include_router(tests.router)
app.include_router(misc.router)


# ---- Static single-page UI -------------------------------------------------
@app.get('/')
def index():
    return FileResponse(os.path.join(STATIC_DIR, 'index.html'))


if os.path.isdir(STATIC_DIR):
    app.mount('/static', StaticFiles(directory=STATIC_DIR), name='static')


if __name__ == '__main__':
    import uvicorn
    uvicorn.run('main:app', host='0.0.0.0', port=8080, reload=False)
